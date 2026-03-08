from pathlib import Path

import httpx
import pytest
import respx

from sentinel.collectors.cidrap import CIDRAP_ALL_NEWS, CIDRAP_FEED, CIDRAPCollector
from sentinel.models.event import Source

FIXTURES = Path(__file__).parent.parent / "fixtures"

ALL_NEWS_HTML = """
<div class="views-row">
  <div class="views-field views-field-rendered-entity">
    <span class="field-content">
      <div class="node">
        <a href="/influenza-general/cdc-reports-11-more-pediatric-flu-deaths" class="field-group-link d-flex">
          <div class="field field--name-node-title field__item"><h3>CDC reports 11 more pediatric flu deaths</h3></div>
          <div class="clearfix text-formatted field field--name-field-teaser field__item"><p>A total of 90 US children have died from flu-related complications this season.</p></div>
        </a>
      </div>
    </span>
  </div>
</div>
"""

ARTICLE_HTML = """
<html>
  <head>
    <meta property="og:title" content="CDC reports 11 more pediatric flu deaths" />
    <meta property="og:description" content="A total of 90 US children have died from flu-related complications this season, according to the latest CDC update." />
  </head>
  <body>
    <div class="field field--name-field-date-time field--type-datetime field--label-hidden field__item">
      <time datetime="2026-03-06T15:27:00-06:00" class="cidrap-publish-time">&nbsp;</time>
    </div>
  </body>
</html>
"""


class TestCIDRAPCollector:
    def setup_method(self):
        self.collector = CIDRAPCollector()

    def test_source_name(self):
        assert self.collector.source_name == "CIDRAP"

    def test_parse_feed(self):
        xml = (FIXTURES / "ecdc_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        assert len(events) == 2

    def test_parse_all_news_extracts_link_title_and_summary(self):
        listings = self.collector.parse_all_news(ALL_NEWS_HTML)
        assert listings == [
            {
                "link": "https://www.cidrap.umn.edu/influenza-general/cdc-reports-11-more-pediatric-flu-deaths",
                "title": "CDC reports 11 more pediatric flu deaths",
                "summary": "A total of 90 US children have died from flu-related complications this season.",
            }
        ]

    def test_parse_article_page_extracts_metadata(self):
        published, title, summary = self.collector.parse_article_page(ARTICLE_HTML)
        assert published and published.isoformat() == "2026-03-06"
        assert title == "CDC reports 11 more pediatric flu deaths"
        assert "latest CDC update" in summary

    @respx.mock
    @pytest.mark.asyncio
    async def test_collect_falls_back_to_all_news(self):
        respx.get(CIDRAP_FEED).mock(return_value=httpx.Response(404, text="missing"))
        respx.get(CIDRAP_ALL_NEWS).mock(return_value=httpx.Response(200, text=ALL_NEWS_HTML))
        respx.get(
            "https://www.cidrap.umn.edu/influenza-general/cdc-reports-11-more-pediatric-flu-deaths"
        ).mock(return_value=httpx.Response(200, text=ARTICLE_HTML))

        events = await self.collector.collect()

        assert len(events) == 1
        assert events[0].source == Source.CIDRAP
        assert events[0].date_reported.isoformat() == "2026-03-06"
        assert events[0].url.endswith("cdc-reports-11-more-pediatric-flu-deaths")
