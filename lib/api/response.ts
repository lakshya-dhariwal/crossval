export function ok<T>(data: T, status = 200) { return Response.json({ data }, { status }); }
