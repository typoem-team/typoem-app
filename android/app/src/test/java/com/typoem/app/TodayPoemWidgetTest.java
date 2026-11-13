package com.typoem.app;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;

import org.junit.Test;

import java.time.Instant;

public class TodayPoemWidgetTest {

    private static final int WIDE = 0;   // width unknown: the badge always fits

    private static long at(String iso) {
        return Instant.parse(iso).toEpochMilli();
    }

    private static String[] line(String saved, int current, int longest, boolean checkedIn) {
        return TodayPoemWidget.streakLine(saved, "2026-11-13", current, longest, checkedIn, WIDE);
    }

    @Test
    public void seoulDateTurnsAtSeoulMidnight() {
        assertEquals("2026-11-13", TodayPoemWidget.seoulDate(at("2026-11-13T14:59:59Z")));   // 23:59:59 KST
        assertEquals("2026-11-14", TodayPoemWidget.seoulDate(at("2026-11-13T15:00:00Z")));   // 00:00 KST
    }

    @Test
    public void daysBetweenDates() {
        assertEquals(0, TodayPoemWidget.daysBetween("2026-11-13", "2026-11-13"));
        assertEquals(1, TodayPoemWidget.daysBetween("2026-10-31", "2026-11-01"));
        assertEquals(-1, TodayPoemWidget.daysBetween("2026-11-14", "2026-11-13"));
        assertEquals(Integer.MAX_VALUE, TodayPoemWidget.daysBetween(null, "2026-11-13"));
        assertEquals(Integer.MAX_VALUE, TodayPoemWidget.daysBetween("", "2026-11-13"));
    }

    @Test
    public void streakSameDay() {   // gap 0
        assertArrayEquals(new String[] {"12일째", " · 오늘 읽었어요 · 30일 배지까지 18일"}, line("2026-11-13", 12, 15, true));
        assertArrayEquals(new String[] {"12일째", " · 오늘 아직이에요 · 30일 배지까지 18일"}, line("2026-11-13", 12, 15, false));
        assertArrayEquals(new String[] {null, "오늘 읽고 다시 시작해요 · 3일 배지까지 3일"}, line("2026-11-13", 0, 0, false));
    }

    @Test
    public void streakNextDay() {   // gap 1: read yesterday keeps it, not read yesterday drops it
        assertArrayEquals(new String[] {"12일째", " · 오늘 아직이에요 · 30일 배지까지 18일"}, line("2026-11-12", 12, 15, true));
        assertArrayEquals(new String[] {null, "오늘 읽고 다시 시작해요 · 30일 배지까지 30일"}, line("2026-11-12", 12, 15, false));
    }

    @Test
    public void streakTwoDaysLater() {   // gap 2: back to 0, longest stays as saved
        assertArrayEquals(new String[] {null, "오늘 읽고 다시 시작해요 · 30일 배지까지 30일"}, line("2026-11-11", 12, 15, true));
        assertArrayEquals(new String[] {null, "오늘 읽고 다시 시작해요 · 30일 배지까지 30일"}, line("2026-11-11", 12, 15, false));
    }

    @Test
    public void nextBadge() {
        assertEquals(3, TodayPoemWidget.nextBadge(0));
        assertEquals(3, TodayPoemWidget.nextBadge(2));
        assertEquals(7, TodayPoemWidget.nextBadge(3));
        assertEquals(7, TodayPoemWidget.nextBadge(6));
        assertEquals(30, TodayPoemWidget.nextBadge(7));
        assertEquals(30, TodayPoemWidget.nextBadge(29));
        assertEquals(0, TodayPoemWidget.nextBadge(30));
    }

    @Test
    public void noBadgePartOnceAllEarned() {
        assertArrayEquals(new String[] {"31일째", " · 오늘 읽었어요"}, line("2026-11-13", 31, 31, true));
    }

    @Test
    public void badgeDroppedFirstWhenNarrow() {
        String[] narrow = TodayPoemWidget.streakLine("2026-11-13", "2026-11-13", 12, 15, true, 250);
        assertArrayEquals(new String[] {"12일째", " · 오늘 읽었어요"}, narrow);
        String[] wide = TodayPoemWidget.streakLine("2026-11-13", "2026-11-13", 12, 15, true, 340);
        assertArrayEquals(new String[] {"12일째", " · 오늘 읽었어요 · 30일 배지까지 18일"}, wide);
    }

    @Test
    public void streakLineKeptBeforePoemLines() {
        assertEquals(3, TodayPoemWidget.rowsThatFit(0));     // launcher gave no size
        assertEquals(3, TodayPoemWidget.rowsThatFit(150));
        assertEquals(2, TodayPoemWidget.rowsThatFit(130));
        assertEquals(1, TodayPoemWidget.rowsThatFit(110));   // minHeight: 4×2 on a small grid
        assertEquals(0, TodayPoemWidget.rowsThatFit(80));    // smallest (minResizeHeight)

        assertEquals(2, TodayPoemWidget.poemLines(3, true));
        assertEquals(1, TodayPoemWidget.poemLines(2, true));
        assertEquals(0, TodayPoemWidget.poemLines(1, true));    // one row: the streak line
        assertEquals(1, TodayPoemWidget.poemLines(1, false));   // no streak (older web): poem line
        assertEquals(2, TodayPoemWidget.poemLines(3, false));
    }

    @Test
    public void roomIdDigitsOnly() {
        assertEquals("/room.html?id=8", TodayPoemWidget.openPath("8"));
        assertEquals("/room.html?id=1234", TodayPoemWidget.openPath("1234"));
        assertEquals("/index.html", TodayPoemWidget.openPath("8&x=1"));
        assertEquals("/index.html", TodayPoemWidget.openPath("../login.html"));
        assertEquals("/index.html", TodayPoemWidget.openPath("javascript:alert(1)"));
        assertEquals("/index.html", TodayPoemWidget.openPath("-1"));
        assertEquals("/index.html", TodayPoemWidget.openPath("8\n"));
    }

    @Test
    public void olderWebDataWithoutRoomIdOrStreak() {
        // roomId missing -> saved as "" (or never saved: null) -> home, like v1.0
        assertEquals("/index.html", TodayPoemWidget.openPath(""));
        assertEquals("/index.html", TodayPoemWidget.openPath(null));
        // streak missing -> hasStreak false -> no streak row, the poem lines get all the rows
        assertEquals(2, TodayPoemWidget.poemLines(TodayPoemWidget.rowsThatFit(130), false));
    }
}
