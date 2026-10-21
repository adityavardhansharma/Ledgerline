// Clerk issues a JWT from a template named "convex" that includes the active organisation:
//   { "org_id": "{{org.id}}", "org_role": "{{org.role}}", "org_name": "{{org.name}}" }
export default {
  providers: [{ domain: process.env.CLERK_JWT_ISSUER_DOMAIN!, applicationID: "convex" }],
};
