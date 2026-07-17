"use client";
import {
  ToggleButtonGroup,
  ToggleButton,
  Card,
  Chip,
  Tabs,
  Pagination,
} from "@heroui/react";
import { useSwipeable } from "react-swipeable";
import { useState, useEffect } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";

import table from "./table.json";

export default function Home() {
  let lsGroup = false;
  if (typeof window !== "undefined") {
    lsGroup = localStorage.getItem("group") == "true";
  }
  const groupC = () => lsGroup;
  function weeksBetween(d1, d2) {
    return Math.round((d2 - d1) / (7 * 24 * 60 * 60 * 1000));
  }
  const [group, setGroup] = useState(groupC);
  const [day, setDay] = useState(0);
  const [page, setPage] = useState(
    Math.abs(
      weeksBetween(
        new Date(),
        new Date(
          table.semesterStart[0],
          table.semesterStart[1],
          table.semesterStart[2],
        ),
      ),
    ),
  );

  const handlers = useSwipeable({
    onSwiped: (eventData) => {
      if (eventData.dir == "Right" && page >= 1) {
        setPage(page - 1);
      } else if (eventData.dir == "Left" && page <= totalPages) {
        setPage(page + 1);
      } else;
    },
    preventScrollOnSwipe: true,
  });

  const totalPages = 18;

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];

    pages.push(1);

    if (page > 3) {
      pages.push("ellipsis");
    }

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (page < totalPages - 2) {
      pages.push("ellipsis");
    }

    pages.push(totalPages);

    return pages;
  };

  useEffect(() => {
    localStorage.setItem("group", group ? "true" : "false");
  }, [group]);

  return (
    <div>
      <div className="flex flex-wrap max-w-200 p-5 justify-between items-center align-middle content-center gap-y-5">
        <div className="flex justify-between items-center">
          <p className="mx-7">Подгруппы</p>
          <ToggleButtonGroup selectionMode="multiple">
            <ToggleButton isSelected={!group} onChange={(v) => setGroup(!v)}>
              1
            </ToggleButton>
            <ToggleButton isSelected={group} onChange={setGroup}>
              <ToggleButtonGroup.Separator />2
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
        <Tabs className="w-full max-w-md justify-center">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Options">
              <Tabs.Tab id="0" onClick={() => setDay(0)}>
                ПН
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="1" onClick={() => setDay(1)}>
                ВТ
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="2" onClick={() => setDay(2)}>
                СР
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="3" onClick={() => setDay(3)}>
                ЧТ
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="4" onClick={() => setDay(4)}>
                ПТ
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="5" onClick={() => setDay(5)}>
                СБ
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </div>
      <div className="max-w-200 p-5" {...handlers}>
        <AnimatePresence initial={false}>
          {table.days[day].table.map((e) => {
            if (
              ((e.group.length == 1 && (e.group[0] == 1) !== group) ||
                (e.group.length == 1 && (e.group[0] == 2) == group) ||
                e.group.length == 2) &&
              e.weeks.includes(page)
            )
              return (
                <motion.div
                  initial={{ opacity: 0, x: -100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 100 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  key={e.timeStart + e.class}
                >
                  <Card className="my-5">
                    <Card.Content>
                      <div className="flex justify-between items-center px-5">
                        <div>
                          <p className="text-xl font-bold">{e.class}</p>
                          {e.group.length !== 2 && (
                            <Chip variant="secondary" className="my-2">
                              {e.group[0]} подгруппа
                            </Chip>
                          )}
                          <p className="">{e.professor}</p>
                          <p className="text-muted">{e.auditorium}</p>
                        </div>
                        <div>
                          <p className="text-l px-4 py-2 bg-accent rounded-full">
                            {e.timeStart}
                          </p>
                        </div>
                      </div>
                    </Card.Content>
                  </Card>
                </motion.div>
              );
            else;
          })}
        </AnimatePresence>
        <div className="w-full max-w-2xs overflow-x-auto sm:max-w-full">
          <Pagination className="justify-center">
            <Pagination.Content>
              {getPageNumbers().map((p, i) =>
                p === "ellipsis" ? (
                  <Pagination.Item key={`ellipsis-${i}`}>
                    <Pagination.Ellipsis />
                  </Pagination.Item>
                ) : (
                  <Pagination.Item key={p}>
                    <Pagination.Link
                      isActive={p === page}
                      onPress={() => setPage(p)}
                    >
                      {p}
                    </Pagination.Link>
                  </Pagination.Item>
                ),
              )}
            </Pagination.Content>
          </Pagination>
        </div>
      </div>
    </div>
  );
}
