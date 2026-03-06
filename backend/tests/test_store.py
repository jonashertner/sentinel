from datetime import date

from sentinel.models.event import HealthEvent, Source, Species
from sentinel.store import DataStore


def _make_event(**kwargs) -> HealthEvent:
    defaults = dict(
        title="Test Event",
        source=Source.WHO_DON,
        date_reported=date(2026, 3, 6),
        date_collected=date(2026, 3, 6),
        disease="H5N1",
        countries=["DE"],
        regions=["EURO"],
        species=Species.ANIMAL,
        summary="Test",
        url="https://example.com",
        raw_content="Test content",
    )
    defaults.update(kwargs)
    return HealthEvent(**defaults)


class TestDataStore:
    def test_save_and_load_events(self, tmp_path):
        store = DataStore(data_dir=str(tmp_path))
        events = [_make_event(), _make_event(disease="Dengue", countries=["BR"])]
        store.save_events(date(2026, 3, 6), events)
        loaded = store.load_events(date(2026, 3, 6))
        assert len(loaded) == 2
        assert loaded[0].disease == "H5N1"

    def test_load_nonexistent_date_returns_empty(self, tmp_path):
        store = DataStore(data_dir=str(tmp_path))
        loaded = store.load_events(date(2026, 1, 1))
        assert loaded == []

    def test_load_all_events(self, tmp_path):
        store = DataStore(data_dir=str(tmp_path))
        store.save_events(date(2026, 3, 5), [_make_event(date_reported=date(2026, 3, 5))])
        store.save_events(date(2026, 3, 6), [_make_event(date_reported=date(2026, 3, 6))])
        all_events = store.load_all_events()
        assert len(all_events) == 2

    def test_save_daily_report(self, tmp_path):
        store = DataStore(data_dir=str(tmp_path))
        store.save_report(date(2026, 3, 6), "# Daily Report\n\nContent here.")
        report = store.load_report(date(2026, 3, 6))
        assert "Daily Report" in report
