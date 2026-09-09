"use client";

import { useEffect, useMemo, useState } from "react";
import type { IndividualLesson, Person } from "@/lib/people";
import { formatWeekRange, getCurrentWeek, getLessonsForWeek, getSubgroupSubjects, type GroupPreference, type IndividualLesson as IL, type Rehearsal, type ScheduleData } from "@/lib/schedule";
