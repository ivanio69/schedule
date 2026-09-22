import type { NextRequest } from "next/server";
import { getPeople } from "@/lib/database";
import { normalizePersonRole, type Person, type PersonRole } from "@/lib/people";

export async function getRoleSessionPerson(request: NextRequest, allowed: PersonRole[]): Promise<Person | null> {
  const personId = request.cookies.get("schedule_profile")?.value ?? "";
  if (!personId) return null;
  const people = await getPeople(false);
  const person = people.find(item => item.id === personId && item.active);
  if (!person) return null;
  const role = normalizePersonRole(person.role, person.adminLink);
  return allowed.includes(role) ? { ...person, role } : null;
}
