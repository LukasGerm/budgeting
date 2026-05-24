// No domain seed data yet. Auth tables (User, Session, Account, Verification)
// are populated by Better Auth at signup, not here. Slice 2 will introduce
// Budget; slice 3 will introduce Expense.
async function main() {
	console.log("Nothing to seed yet.");
}

main().catch((e) => {
	console.error("Error seeding database:", e);
	process.exit(1);
});
