from pydantic import BaseModel


class Organization(BaseModel):
    id: str
    name: str
    domain_focus: list[str]
    species_filter: list[str]
    priority_sources: list[str]
    report_template: str = "default"


ORGANIZATIONS: dict[str, Organization] = {
    "BLV": Organization(
        id="BLV",
        name="Federal Food Safety and Veterinary Office",
        domain_focus=["zoonotic", "vector-borne", "foodborne", "AMR", "animal_health"],
        species_filter=["animal", "both"],
        priority_sources=["WOAH", "ECDC", "PROMED"],
    ),
    "BAG": Organization(
        id="BAG",
        name="Federal Office of Public Health",
        domain_focus=["pandemic", "respiratory", "vaccine-preventable", "travel_health", "AMR"],
        species_filter=["human", "both"],
        priority_sources=["WHO_DON", "ECDC", "WHO_EIOS"],
    ),
    "JOINT": Organization(
        id="JOINT",
        name="Joint One Health Coordination",
        domain_focus=["zoonotic", "AMR", "vector-borne"],
        species_filter=["both"],
        priority_sources=["WHO_DON", "WOAH", "ECDC", "PROMED", "WHO_EIOS"],
    ),
}
