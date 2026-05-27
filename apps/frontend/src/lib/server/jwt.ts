import { jwtDecode, type JwtPayload } from "jwt-decode";

export function decode(accessToken: string) {
  try {
    return jwtDecode<JwtPayload & { role: string }>(accessToken);
  } catch (error) {
    return { role: "anonymous" } as JwtPayload & { role: string };
  }
}
