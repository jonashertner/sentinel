from sentinel.collectors.bag_bulletin import BAGBulletinCollector
from sentinel.models.event import Source, Species

SAMPLE_HTML = """
<html><body>
<article>
    <h3>Masern-Ausbruch in der Zentralschweiz</h3>
    <p class="lead">12 bestätigte Fälle in den Kantonen LU und OW.</p>
    <a href="/bag/de/home/disease/masern-update">Mehr</a>
</article>
<article>
    <h3>COVID-19 Lagebericht Woche 10</h3>
    <p class="lead">Stabile Situation, keine Besorgniserregenden Varianten.</p>
    <a href="https://www.bag.admin.ch/covid19-report">Bericht</a>
</article>
</body></html>
"""


class TestBAGBulletinCollector:
    def setup_method(self):
        self.collector = BAGBulletinCollector()

    def test_source_name(self):
        assert self.collector.source_name == "BAG_BULLETIN"

    def test_parse_page(self):
        events = self.collector.parse_page(SAMPLE_HTML)
        assert len(events) == 2
        for event in events:
            assert event.source == Source.BAG_BULLETIN
            assert event.countries == ["CH"]
            assert event.species == Species.HUMAN
            assert event.swiss_relevance == 1.0

    def test_disease_extraction(self):
        events = self.collector.parse_page(SAMPLE_HTML)
        assert events[0].disease == "Masern"
        assert events[1].disease == "COVID-19"

    def test_url_resolution(self):
        events = self.collector.parse_page(SAMPLE_HTML)
        assert events[0].url.startswith("https://www.bag.admin.ch")
        assert events[1].url.startswith("https://www.bag.admin.ch")
