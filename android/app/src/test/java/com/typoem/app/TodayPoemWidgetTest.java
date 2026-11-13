package com.typoem.app;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

import java.time.Instant;

public class TodayPoemWidgetTest {

    private static long at(String iso) {
        return Instant.parse(iso).toEpochMilli();
    }

    @Test
    public void seoulDateTurnsAtSeoulMidnight() {
        assertEquals("2026-11-13", TodayPoemWidget.seoulDate(at("2026-11-13T14:59:59Z")));   // 23:59:59 KST
        assertEquals("2026-11-14", TodayPoemWidget.seoulDate(at("2026-11-13T15:00:00Z")));   // 00:00 KST
    }

    @Test
    public void fewerPoemLinesWhenShorter() {
        assertEquals(2, TodayPoemWidget.linesThatFit(0));     // launcher gave no size
        assertEquals(2, TodayPoemWidget.linesThatFit(140));
        assertEquals(1, TodayPoemWidget.linesThatFit(110));   // minHeight: 4×2 on a small grid
        assertEquals(0, TodayPoemWidget.linesThatFit(80));    // smallest (minResizeHeight)
    }
}
