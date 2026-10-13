"""Keep accepted-artifact checks separate from system-wide readiness."""


def completion_scope(component_status):
    return {
        "status": "COMPONENT_CHECKS_PASSED" if component_status == "GREEN" else "REPAIR_REQUIRED",
        "component_checks_passed": component_status == "GREEN",
        "machine_system_complete": False,
        "production_ready": False,
        "status_scope": "Accepted V10 artifact and recorded component checks only; not live end-to-end production readiness",
        "remaining_user_gate": "Live integration and current candidate acceptance remain required before any publication approval",
    }
