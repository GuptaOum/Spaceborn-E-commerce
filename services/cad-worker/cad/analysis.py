"""Mesh metrics and instant fabrication estimates. Pure functions: bytes in, numbers out."""

import io
import math
import zipfile
from dataclasses import asdict, dataclass

import numpy as np
import trimesh

MESH_FORMATS = {".stl": "stl", ".obj": "obj", ".3mf": "3mf", ".step": "step", ".stp": "step", ".iges": "iges", ".igs": "iges"}
MAX_FACES = 3_000_000
MAX_3MF_ENTRIES = 64
MAX_3MF_UNCOMPRESSED = 400 * 1024 * 1024


class UnsupportedFormat(Exception):
    pass


class RejectedFile(Exception):
    pass


@dataclass(frozen=True)
class Metrics:
    format: str
    dimensionsMm: tuple[float, float, float]
    volumeCm3: float
    surfaceAreaCm2: float
    triangles: int
    watertight: bool
    fitsBuildVolume: bool | None

    def to_dict(self) -> dict:
        d = asdict(self)
        d["dimensionsMm"] = list(self.dimensionsMm)
        return d


def _guard_3mf(data: bytes) -> None:
    """Reject a 3MF whose real uncompressed bytes, not the zip header, exceed the cap.

    The header's file_size is chosen by whoever built the archive, so a bomb can claim a tiny size.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            infos = z.infolist()
            if len(infos) > MAX_3MF_ENTRIES:
                raise RejectedFile("3MF archive has too many entries")
            read = 0
            for info in infos:
                with z.open(info) as src:
                    while True:
                        chunk = src.read(1024 * 1024)
                        if not chunk:
                            break
                        read += len(chunk)
                        if read > MAX_3MF_UNCOMPRESSED:
                            raise RejectedFile("3MF archive expands too much")
    except zipfile.BadZipFile as err:
        raise RejectedFile("not a valid 3MF archive") from err


def load_mesh(data: bytes, ext: str) -> trimesh.Trimesh:
    file_type = MESH_FORMATS.get(ext.lower())
    if not file_type:
        raise UnsupportedFormat(ext)
    if file_type == "3mf":
        _guard_3mf(data)
    try:
        # No resolver: an OBJ that references .mtl or texture files never reads anything from disk.
        loaded = trimesh.load(io.BytesIO(data), file_type=file_type, force="mesh", process=True)
    except (ImportError, NotImplementedError) as err:
        raise UnsupportedFormat(f"{ext}: {err}"[:200]) from err
    except MemoryError:
        raise
    except Exception as err:  # parsers raise many types on malformed input
        raise RejectedFile(f"could not read the file ({type(err).__name__})") from err
    if not isinstance(loaded, trimesh.Trimesh) or len(loaded.faces) == 0:
        raise RejectedFile("no solid geometry found")
    if len(loaded.faces) > MAX_FACES:
        raise RejectedFile("mesh has too many triangles")
    return loaded


def fits(dims: tuple[float, float, float], build: tuple[int, int, int] | None) -> bool | None:
    """Any orientation counts: the part fits when its sorted sides fit the sorted build volume."""
    if not build or not all(build):
        return None
    return all(d <= b for d, b in zip(sorted(dims), sorted(build)))


def measure(mesh: trimesh.Trimesh, file_type: str, build: tuple[int, int, int] | None = None) -> Metrics:
    extents = tuple(round(float(e), 1) for e in mesh.extents)
    watertight = bool(mesh.is_watertight)
    # Open meshes have no defined volume; the convex hull gives an upper bound vendors can still price from.
    volume_mm3 = abs(float(mesh.volume)) if watertight else float(mesh.convex_hull.volume)
    area_mm2 = float(mesh.area)
    if not math.isfinite(volume_mm3) or not math.isfinite(area_mm2) or not all(math.isfinite(e) for e in extents):
        raise RejectedFile("could not measure the mesh")
    return Metrics(
        format=file_type,
        dimensionsMm=extents,  # type: ignore[arg-type]
        volumeCm3=round(volume_mm3 / 1000, 2),
        surfaceAreaCm2=round(area_mm2 / 100, 2),
        triangles=int(len(mesh.faces)),
        watertight=watertight,
        fitsBuildVolume=fits(extents, build),  # type: ignore[arg-type]
    )


def analyze(data: bytes, ext: str, build: tuple[int, int, int] | None = None) -> Metrics:
    mesh = load_mesh(data, ext)
    return measure(mesh, MESH_FORMATS[ext.lower()], build)


# (density g/cm3, material cost Rs/g). Matched by substring of the customer's material choice.
PRINT_MATERIALS = {
    "petg": (1.27, 3.5), "pla": (1.24, 3.0), "abs": (1.04, 3.5), "asa": (1.07, 4.0), "tpu": (1.21, 6.0),
    "nylon": (1.14, 8.0), "pa12": (1.01, 9.0), "resin": (1.15, 9.0), "carbon": (1.30, 9.0),
}
CNC_MATERIALS = {
    "alumin": (2.70, 0.6), "steel": (7.85, 0.25), "stainless": (8.00, 0.5), "brass": (8.50, 1.2), "copper": (8.96, 1.4),
    "acrylic": (1.18, 0.4), "delrin": (1.41, 0.8), "pom": (1.41, 0.8), "nylon": (1.14, 0.8), "wood": (0.70, 0.1), "mdf": (0.75, 0.08),
}
SHELL_CM = 0.12  # two 0.6 mm perimeters
INFILL = 0.20
FDM_GRAMS_PER_HOUR = 12.0
RESIN_MM_PER_HOUR = 20.0
PRINT_SETUP, PRINT_RATE_PER_HOUR = 80.0, 40.0
CNC_SETUP, CNC_RATE_PER_HOUR = 300.0, 600.0
CNC_STOCK_MARGIN_MM = 3.0
CNC_REMOVAL_CM3_PER_HOUR = {"soft": 240.0, "hard": 60.0}


def _match(material: str, table: dict[str, tuple[float, float]], default: str) -> tuple[str, float, float]:
    m = material.lower()
    key = next((k for k in table if k in m), default)
    return key, *table[key]


def _round10(x: float) -> int:
    return int(max(10, round(x / 10) * 10))


def estimate(metrics: Metrics, kind: str, material: str, quantity: int = 1) -> dict:
    qty = max(1, int(quantity))
    if kind == "cnc":
        key, density, rate = _match(material, CNC_MATERIALS, "alumin")
        stock_cm3 = float(np.prod([d + 2 * CNC_STOCK_MARGIN_MM for d in metrics.dimensionsMm])) / 1000
        removal_cm3 = max(0.0, stock_cm3 - metrics.volumeCm3)
        hard = key in ("steel", "stainless", "brass", "copper")
        hours = removal_cm3 / CNC_REMOVAL_CM3_PER_HOUR["hard" if hard else "soft"] + 0.3
        mass = metrics.volumeCm3 * density
        unit = stock_cm3 * density * rate + hours * CNC_RATE_PER_HOUR
        price = CNC_SETUP + unit * qty
    else:
        key, density, rate = _match(material, PRINT_MATERIALS, "pla")
        if key == "resin":
            effective = metrics.volumeCm3 * 0.6
            hours = metrics.dimensionsMm[2] / RESIN_MM_PER_HOUR + 0.5
        else:
            shell = min(metrics.volumeCm3, metrics.surfaceAreaCm2 * SHELL_CM)
            effective = shell + INFILL * (metrics.volumeCm3 - shell)
            hours = effective * density / FDM_GRAMS_PER_HOUR + 0.25
        mass = effective * density
        price = PRINT_SETUP + (mass * rate + hours * PRINT_RATE_PER_HOUR) * qty
    return {
        "kind": kind,
        "material": material[:40],
        "massGrams": round(mass, 1),
        "machineHours": round(hours * qty, 1),
        "priceInr": _round10(price),
    }
