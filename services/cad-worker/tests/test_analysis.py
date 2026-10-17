import io
import zipfile

import pytest
import trimesh

from cad.analysis import RejectedFile, UnsupportedFormat, analyze, estimate, fits


def stl(mesh: trimesh.Trimesh) -> bytes:
    return mesh.export(file_type="stl")


def test_cube_metrics():
    m = analyze(stl(trimesh.creation.box(extents=(20, 20, 20))), ".stl", (220, 220, 250))
    assert m.dimensionsMm == (20.0, 20.0, 20.0)
    assert m.volumeCm3 == pytest.approx(8.0, rel=1e-3)
    assert m.surfaceAreaCm2 == pytest.approx(24.0, rel=1e-3)
    assert m.watertight is True and m.fitsBuildVolume is True and m.format == "stl"


def test_obj_and_case_insensitive_extension():
    data = trimesh.creation.cylinder(radius=10, height=30).export(file_type="obj").encode()
    m = analyze(data, ".OBJ")
    assert m.dimensionsMm[2] == pytest.approx(30.0, abs=0.1)


def test_open_mesh_uses_hull_and_is_flagged():
    box = trimesh.creation.box(extents=(10, 10, 10))
    open_box = trimesh.Trimesh(vertices=box.vertices, faces=box.faces[:-2])
    m = analyze(stl(open_box), ".stl")
    assert m.watertight is False
    assert m.volumeCm3 == pytest.approx(1.0, rel=1e-3)


def test_fits_any_orientation():
    assert fits((300.0, 50.0, 40.0), (220, 220, 310)) is True
    assert fits((300.0, 250.0, 40.0), (220, 220, 310)) is False
    assert fits((10.0, 10.0, 10.0), None) is None


def test_2d_formats_are_unsupported():
    with pytest.raises(UnsupportedFormat):
        analyze(b"0\nSECTION", ".dxf")


def test_garbage_is_rejected():
    with pytest.raises(RejectedFile):
        analyze(b"solid nothing\nendsolid nothing\n", ".stl")


def test_3mf_zip_bomb_is_rejected_before_loading(monkeypatch):
    monkeypatch.setattr("cad.analysis.MAX_3MF_UNCOMPRESSED", 1000)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("3D/3dmodel.model", "0" * 50_000)
    with pytest.raises(RejectedFile, match="expands"):
        analyze(buf.getvalue(), ".3mf")


def test_3mf_lying_header_is_still_capped(monkeypatch):
    monkeypatch.setattr("cad.analysis.MAX_3MF_UNCOMPRESSED", 1000)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:
        z.writestr("3D/3dmodel.model", "0" * 50_000)
    real_open = zipfile.ZipFile

    class LyingHeader(real_open):
        def infolist(self):
            infos = super().infolist()
            for info in infos:
                info.file_size = 1
            return infos

    monkeypatch.setattr("cad.analysis.zipfile.ZipFile", LyingHeader)
    # A header that disagrees with the bytes is rejected either while reading or as a bad archive.
    # Either way the mesh is never loaded.
    with pytest.raises(RejectedFile, match="expands|not a valid"):
        analyze(buf.getvalue(), ".3mf")


def test_print_estimate_scales_with_quantity_but_setup_is_once():
    m = analyze(stl(trimesh.creation.box(extents=(40, 40, 40))), ".stl")
    one = estimate(m, "3d_printing", "PLA", 1)
    five = estimate(m, "3d_printing", "PLA", 5)
    assert one["material"] == "PLA" and one["massGrams"] > 0 and one["priceInr"] % 10 == 0
    assert one["priceInr"] < five["priceInr"] < 5 * one["priceInr"]


def test_cnc_harder_material_costs_more():
    m = analyze(stl(trimesh.creation.box(extents=(50, 30, 10))), ".stl")
    alu = estimate(m, "cnc", "Aluminium 6061", 1)
    steel = estimate(m, "cnc", "Mild Steel", 1)
    assert steel["machineHours"] > alu["machineHours"]
    assert alu["priceInr"] >= 300
