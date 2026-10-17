"""Deterministic cart checks. The model words the advice; these rules decide whether there is any."""

import re
from dataclasses import asdict, dataclass

from .schemas import CartLine


@dataclass(frozen=True)
class Finding:
    rule: str
    kind: str  # "missing_companion" | "electrical"
    trigger: str
    message: str
    search_query: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class Rule:
    id: str
    kind: str
    # Every pattern must match some cart item; the first one names the trigger.
    when: tuple[re.Pattern, ...]
    # No finding when any cart item matches this.
    unless: re.Pattern
    message: str
    search_query: str


def _re(pattern: str) -> re.Pattern:
    return re.compile(pattern, re.IGNORECASE)


USB_C_PSU = _re(
    r"(power supply|power adapter|adapter|psu|charger).*(usb.?c|type.?c)|(usb.?c|type.?c).*(power supply|adapter|psu)|\b27\s?w\b|\b15\s?w\b"
)
MICRO_SD = _re(r"micro.?sd|sd card|tf card")
MCU_3V3 = _re(r"esp32|esp8266|nodemcu|raspberry pi|rp2040|\bpico\b|stm32")

# Deliberately narrow: a missed suggestion costs nothing, a wrong one costs trust.
RULES: tuple[Rule, ...] = (
    Rule(
        "rpi5-power", "missing_companion", (_re(r"raspberry pi 5"),), _re(r"\b27\s?w\b|5v\s?5a|5\.1v\s?5a"),
        "A Raspberry Pi 5 needs a 27W (5V/5A) USB-C supply; weaker adapters throttle USB power and cause brown-outs.",
        "27W USB-C power supply Raspberry Pi 5",
    ),
    Rule(
        "rpi4-power", "missing_companion", (_re(r"raspberry pi 4"),), USB_C_PSU,
        "A Raspberry Pi 4 needs a 15W (5V/3A) USB-C supply.",
        "15W USB-C power supply Raspberry Pi 4",
    ),
    Rule(
        "rpi-hdmi", "missing_companion", (_re(r"raspberry pi [45]"),), _re(r"micro.?hdmi"),
        "Raspberry Pi 4 and 5 have micro-HDMI ports, so a standard HDMI cable will not fit.",
        "micro HDMI to HDMI cable",
    ),
    Rule(
        "rpi-sd", "missing_companion", (_re(r"raspberry pi [345]"),), MICRO_SD,
        "The Raspberry Pi boots from a microSD card, which is not included with the board.",
        "microSD card 32GB class 10",
    ),
    Rule(
        "stepper-driver", "missing_companion", (_re(r"stepper|nema ?17|nema ?23|28byj"),),
        _re(r"driver|a4988|drv8825|tmc2\d{3}|uln2003|cnc shield"),
        "Stepper motors cannot be driven from GPIO pins directly; they need a stepper driver.",
        "stepper motor driver A4988 DRV8825",
    ),
    Rule(
        "dc-motor-driver", "missing_companion", (_re(r"\b(dc|bo|gear(ed)?|n20) motor|motor.*\b\d+\s?rpm\b"),),
        _re(r"driver|l298|l293|tb6612|drv8833|bts7960|h.?bridge|motor shield"),
        "DC motors draw far more current than a GPIO pin can supply; use a motor driver (H-bridge).",
        "motor driver L298N TB6612",
    ),
    Rule(
        "bldc-esc", "missing_companion", (_re(r"brushless|bldc"),), _re(r"\besc\b|speed controller"),
        "A brushless motor needs an ESC (electronic speed controller) rated for its current.",
        "brushless ESC 30A",
    ),
    Rule(
        "lipo-charger", "missing_companion", (_re(r"lipo|li-po|lithium polymer"),), _re(r"charger|imax|\bb3\b|\bb6\b|balance"),
        "LiPo packs must be charged with a balance charger; charging them any other way is a fire risk.",
        "LiPo balance charger",
    ),
    Rule(
        "18650-protection", "missing_companion", (_re(r"18650"),), _re(r"charger|tp4056|\bbms\b|protection|holder"),
        "Bare 18650 cells need a holder and a protected charger or BMS board.",
        "TP4056 18650 charger BMS",
    ),
    Rule(
        "5v-sensor-3v3-logic", "electrical", (_re(r"hc-?sr04|ultrasonic"), MCU_3V3),
        _re(r"level shift|logic level|level convert|bi-?directional"),
        "The HC-SR04 echo pin outputs 5V, but ESP32/ESP8266/Raspberry Pi GPIOs are 3.3V-only. "
        "Use a logic level converter or a voltage divider on ECHO.",
        "logic level converter 4 channel",
    ),
    Rule(
        "5v-relay-3v3-logic", "electrical", (_re(r"5\s?v relay|relay module"), MCU_3V3),
        _re(r"3\.3\s?v relay|optocoupler|level shift|logic level"),
        "Many 5V relay boards do not switch reliably from a 3.3V GPIO. "
        "Power the board from 5V and pick an opto-isolated or 3.3V-trigger relay module.",
        "3.3V trigger relay module optocoupler",
    ),
    Rule(
        "ws2812-power", "electrical", (_re(r"ws2812|neopixel|addressable led"),), _re(r"power supply|adapter|smps|psu"),
        "Addressable LED strips draw up to 60mA per LED at full white; plan a separate 5V supply instead of the board regulator.",
        "5V 4A power supply adapter",
    ),
)


def check_cart(lines: list[CartLine]) -> list[Finding]:
    texts = [f"{line.name} {line.category or ''}" for line in lines]
    findings: list[Finding] = []
    for rule in RULES:
        trigger = next((i for i, t in enumerate(texts) if rule.when[0].search(t)), None)
        if trigger is None:
            continue
        if not all(any(p.search(t) for t in texts) for p in rule.when[1:]):
            continue
        if any(rule.unless.search(t) for t in texts):
            continue
        findings.append(Finding(rule.id, rule.kind, lines[trigger].name, rule.message, rule.search_query))
    return findings
