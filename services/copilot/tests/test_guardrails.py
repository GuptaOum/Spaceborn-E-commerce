from app.guardrails import check_cart
from app.schemas import CartLine


def cart(*names: str) -> list[CartLine]:
    return [CartLine(productId=f"p{i}", name=n, quantity=1) for i, n in enumerate(names)]


def rules(*names: str) -> set[str]:
    return {f.rule for f in check_cart(cart(*names))}


def test_raspberry_pi_5_alone_needs_power_hdmi_and_sd():
    assert rules("Raspberry Pi 5 (8GB)") == {"rpi5-power", "rpi-hdmi", "rpi-sd"}


def test_companions_in_cart_clear_findings():
    assert rules("Raspberry Pi 5 (8GB)", "Official 27W USB-C Power Supply", "Micro HDMI to HDMI cable", "SanDisk microSD 64GB") == set()


def test_cross_item_electrical_rule_needs_both_items():
    assert "5v-sensor-3v3-logic" not in rules("HC-SR04 Ultrasonic Sensor")
    assert "5v-sensor-3v3-logic" in rules("HC-SR04 Ultrasonic Sensor", "ESP32 DevKit V1")
    assert "5v-sensor-3v3-logic" not in rules("HC-SR04 Ultrasonic Sensor", "ESP32 DevKit V1", "4 Channel Logic Level Converter")


def test_trigger_names_the_cart_item():
    [finding] = [f for f in check_cart(cart("NEMA 17 Stepper Motor")) if f.rule == "stepper-driver"]
    assert finding.trigger == "NEMA 17 Stepper Motor"
    assert finding.kind == "missing_companion"


def test_unrelated_items_have_no_findings():
    assert rules("10k Resistor pack", "Breadboard 830 points") == set()
