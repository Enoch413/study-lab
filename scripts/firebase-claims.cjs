#!/usr/bin/env node

const { loadEnvConfig } = require("@next/env");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

loadEnvConfig(process.cwd());

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
});

async function main() {
  const [command = "help", ...restArgs] = process.argv.slice(2);
  const flags = parseFlags(restArgs);
  const auth = getAuth(getFirebaseAdminApp());

  switch (command) {
    case "help":
      printHelp();
      return;
    case "list":
      await listUsers(auth, flags);
      return;
    case "show":
      await showUser(auth, flags);
      return;
    case "set":
      await setClaims(auth, flags);
      return;
    case "clear":
      await clearClaims(auth, flags);
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function printHelp() {
  console.log(`Firebase custom claims helper

Commands:
  help
    Show this help message.

  list [--max 20]
    List Firebase Auth users in the current project.

  show (--uid UID | --email EMAIL)
    Show one user's current custom claims.

  set (--uid UID | --email EMAIL) --role student|admin [--scope assigned|all]
    Set STUDY LAB custom claims for one user.
    Use role=student for student accounts.
    Use role=admin with scope=assigned for teacher accounts.
    Use role=admin with scope=all for full admin accounts.

  clear (--uid UID | --email EMAIL)
    Remove only the STUDY LAB role/adminScope claims and keep any other claims.

Examples:
  node scripts/firebase-claims.cjs list --max 10
  node scripts/firebase-claims.cjs show --email teacher@example.com
  node scripts/firebase-claims.cjs set --email teacher@example.com --role admin --scope assigned
  node scripts/firebase-claims.cjs set --email student@example.com --role student
  node scripts/firebase-claims.cjs clear --email teacher@example.com
`);
}

function parseFlags(args) {
  const flags = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const value = args[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    flags[key] = value;
    index += 1;
  }

  return flags;
}

function getFirebaseAdminApp() {
  const existingApp = getApps().find((app) => app.name === "study-lab-claims-script");

  if (existingApp) {
    return existingApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    return initializeApp(
      {
        credential: cert(JSON.parse(serviceAccountJson)),
      },
      "study-lab-claims-script",
    );
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
    );
  }

  return initializeApp(
    {
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    },
    "study-lab-claims-script",
  );
}

async function listUsers(auth, flags) {
  const maxUsers = Number.parseInt(flags.max ?? "20", 10);

  if (!Number.isFinite(maxUsers) || maxUsers <= 0) {
    throw new Error("--max must be a positive integer");
  }

  const result = await auth.listUsers(maxUsers);

  if (!result.users.length) {
    console.log("No Firebase Auth users found.");
    return;
  }

  for (const user of result.users) {
    console.log(formatUserLine(user));
  }

  if (result.pageToken) {
    console.log(`More users are available. Re-run with a larger --max if needed.`);
  }
}

async function showUser(auth, flags) {
  const user = await resolveUser(auth, flags);

  console.log(formatUserDetails(user));
}

async function setClaims(auth, flags) {
  const role = normalizeRole(flags.role);
  const scope = normalizeScope(flags.scope);
  const user = await resolveUser(auth, flags);
  const currentClaims = user.customClaims ?? {};

  if (role === "student" && scope) {
    throw new Error("Students cannot have an admin scope.");
  }

  if (role === "admin" && !scope) {
    throw new Error("Admins must include --scope assigned or --scope all.");
  }

  const nextClaims = {
    ...currentClaims,
    role,
  };

  if (role === "admin") {
    nextClaims.adminScope = scope;
  } else {
    delete nextClaims.adminScope;
  }

  await auth.setCustomUserClaims(user.uid, nextClaims);

  const updatedUser = await auth.getUser(user.uid);
  console.log(`Updated claims for ${updatedUser.email ?? updatedUser.uid}`);
  console.log(formatUserDetails(updatedUser));
}

async function clearClaims(auth, flags) {
  const user = await resolveUser(auth, flags);
  const nextClaims = {
    ...(user.customClaims ?? {}),
  };

  delete nextClaims.role;
  delete nextClaims.adminScope;

  await auth.setCustomUserClaims(user.uid, Object.keys(nextClaims).length ? nextClaims : null);

  const updatedUser = await auth.getUser(user.uid);
  console.log(`Cleared STUDY LAB claims for ${updatedUser.email ?? updatedUser.uid}`);
  console.log(formatUserDetails(updatedUser));
}

async function resolveUser(auth, flags) {
  const uid = typeof flags.uid === "string" ? flags.uid.trim() : "";
  const email = typeof flags.email === "string" ? flags.email.trim() : "";

  if (!uid && !email) {
    throw new Error("Provide either --uid or --email.");
  }

  if (uid && email) {
    throw new Error("Use only one identifier: --uid or --email.");
  }

  if (uid) {
    return auth.getUser(uid);
  }

  return auth.getUserByEmail(email);
}

function normalizeRole(value) {
  if (value === "student" || value === "admin") {
    return value;
  }

  throw new Error("--role must be student or admin");
}

function normalizeScope(value) {
  if (value == null) {
    return null;
  }

  if (value === "assigned" || value === "all") {
    return value;
  }

  throw new Error("--scope must be assigned or all");
}

function formatUserLine(user) {
  const claims = JSON.stringify(user.customClaims ?? {});
  return [
    user.uid,
    user.email ?? "(no email)",
    user.displayName ?? "(no name)",
    claims,
  ].join(" | ");
}

function formatUserDetails(user) {
  return [
    `uid: ${user.uid}`,
    `email: ${user.email ?? "(no email)"}`,
    `name: ${user.displayName ?? "(no name)"}`,
    `disabled: ${user.disabled ? "true" : "false"}`,
    `claims: ${JSON.stringify(user.customClaims ?? {}, null, 2)}`,
  ].join("\n");
}
