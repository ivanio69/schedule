import type { NextRequest } from "next/server";
import { AUTH_COOKIE, verifyAuthSessionToken } from "@/lib/auth-session";
import { getPeople } from "@/lib/database";
import { normalizePersonRole, type Person, type PersonRole } from "@/lib/people";

export async function getRoleSessionPerson(request: NextRequest, allowed: PersonRole[]): Promise<Person | null> {
  const session = verifyAuthSessionToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (!session) return null;
  const people = await getPeople(false);
  const person = people.find(item => item.id === session.personId && item.active);
  if (!person) return null;
  const role = normalizePersonRole(person.role, person.adminLink);
  return allowed.includes(role) ? { ...person, role } : null;
}
