import { asc, eq, like, or } from 'drizzle-orm';
import { drizzleDb } from './drizzle';
import { drugs } from './schema';

export type DrugGroupItem = {
	drugCode: string;
	drugName: string;
	manufactor: string;
	atcCode: string;
	atcName: string;
};

export const getAtcPrefix = (atcCode: string) => atcCode.slice(0, 5);

export const getRepresentativeDrugsByAtcPrefixes = async (prefixes: string[]) => {
	const uniquePrefixes = Array.from(new Set(prefixes.filter((prefix) => prefix.length === 5)));
	if (uniquePrefixes.length === 0) {
		return new Map<string, DrugGroupItem>();
	}

	const conditions = uniquePrefixes.map((prefix) => like(drugs.atcCode, `${prefix}%`));
	const rows = await drizzleDb
		.select({
			drugCode: drugs.drugCode,
			drugName: drugs.drugName,
			manufactor: drugs.manufactor,
			atcCode: drugs.atcCode,
			atcName: drugs.atcName
		})
		.from(drugs)
		.where(conditions.length === 1 ? conditions[0] : or(...conditions))
		.orderBy(asc(drugs.atcCode), asc(drugs.drugCode));

	const prefixSet = new Set(uniquePrefixes);
	const representatives = new Map<string, DrugGroupItem>();

	for (const row of rows) {
		const prefix = getAtcPrefix(row.atcCode);
		if (prefixSet.has(prefix) && !representatives.has(prefix)) {
			representatives.set(prefix, row);
		}
	}

	return representatives;
};

export const getAssociatedDrugsByDrugCode = async (drugCode: string) => {
	const [baseDrug] = await drizzleDb
		.select({ atcCode: drugs.atcCode })
		.from(drugs)
		.where(eq(drugs.drugCode, drugCode))
		.limit(1);

	if (!baseDrug) {
		return [] as DrugGroupItem[];
	}

	const prefix = getAtcPrefix(baseDrug.atcCode);

	return drizzleDb
		.select({
			drugCode: drugs.drugCode,
			drugName: drugs.drugName,
			manufactor: drugs.manufactor,
			atcCode: drugs.atcCode,
			atcName: drugs.atcName
		})
		.from(drugs)
		.where(like(drugs.atcCode, `${prefix}%`))
		.orderBy(asc(drugs.drugName), asc(drugs.drugCode));
};
