import { PrismaClient } from "../../apps/api/node_modules/@prisma/client/default.js";
const prisma = new PrismaClient();
try {
  const rows = await prisma.integrationAccount.findMany({ select: { provider: true, providerAccountId: true } });
  const seen = new Set();
  let duplicateRows = 0;
  for (const row of rows) {
    const key = `${row.provider}\0${row.providerAccountId}`;
    if (seen.has(key)) duplicateRows += 1;
    else seen.add(key);
  }
  console.log(`INTEGRATION_ACCOUNT_ROWS=${rows.length}`);
  console.log(`DUPLICATE_PROVIDER_ACCOUNT_ROWS=${duplicateRows}`);
  process.exitCode = duplicateRows ? 1 : 0;
} finally {
  await prisma.$disconnect();
}