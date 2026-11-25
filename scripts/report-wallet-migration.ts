import fs from 'node:fs/promises';
import path from 'node:path';

type Classification =
  | 'wallet-only'
  | 'connector-only'
  | 'hybrid-one-product'
  | 'separate-products'
  | 'manual-review';

interface Wallet {
  id: string;
  name?: string;
  type?: string;
  orgId?: string;
  description?: string;
  capabilities?: string[];
  issuanceProtocols?: string[];
  presentationProtocols?: string[];
}

interface Decision {
  classification: Classification;
  reason: string;
  reviewStatus: 'reviewed' | 'pending';
  targetId?: string;
  uncertainty: 'low' | 'medium' | 'high';
}

const ROOT = process.cwd();
const WALLET_PATH =
  process.env.WALLET_CATALOG_AGGREGATED_PATH ||
  path.resolve(ROOT, '..', 'wallet-catalog', 'data', 'aggregated.json');
const OUTPUT_PATH = path.join(ROOT, 'reports', 'organizational-wallet-migration-dry-run.md');

const MANUAL_DECISIONS: Record<string, Decision> = {
  'yourd-business-wallet': {
    classification: 'wallet-only',
    reason: 'Description explicitly says the product issues, holds, and verifies credentials; missing holder capability is a wallet data-quality issue.',
    reviewStatus: 'reviewed',
    uncertainty: 'low',
  },
  'procivis-one': {
    classification: 'hybrid-one-product',
    reason: 'Description identifies a business wallet that holds and presents credentials, while the same product also exposes issuer and verifier functions.',
    reviewStatus: 'reviewed',
    targetId: 'procivis-one',
    uncertainty: 'medium',
  },
  'eudi-reference-issuer': {
    classification: 'connector-only',
    reason: 'Reference issuing backend has no Holder function and is represented in the connector catalog.',
    reviewStatus: 'reviewed',
    targetId: 'eudi-reference-issuer',
    uncertainty: 'low',
  },
  'eudi-reference-verifier': {
    classification: 'connector-only',
    reason: 'Reference verifier backend has no Holder function and is represented in the connector catalog.',
    reviewStatus: 'reviewed',
    targetId: 'eudi-reference-verifier',
    uncertainty: 'low',
  },
};

function inferredDecision(wallet: Wallet): Decision {
  const capabilities = wallet.capabilities || [];
  const hasConnectorSignals =
    capabilities.includes('issuer') ||
    capabilities.includes('verifier') ||
    Boolean(wallet.issuanceProtocols?.length) ||
    Boolean(wallet.presentationProtocols?.length);
  return {
    classification: 'manual-review',
    reason: hasConnectorSignals
      ? 'Issuer/verifier signals exist, but product boundaries and Holder behavior require source review.'
      : 'Holder is absent and available metadata is insufficient for an automatic product classification.',
    reviewStatus: 'pending',
    uncertainty: 'high',
  };
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

async function main(): Promise<void> {
  const data = JSON.parse(await fs.readFile(WALLET_PATH, 'utf8')) as { wallets?: Wallet[] };
  const candidates = (data.wallets || [])
    .filter(
      (wallet) =>
        wallet.type === 'organizational' &&
        !(wallet.capabilities || []).includes('holder'),
    )
    .sort((a, b) => a.id.localeCompare(b.id));

  const rows = candidates.map((wallet) => {
    const decision = MANUAL_DECISIONS[wallet.id] || inferredDecision(wallet);
    return {
      wallet,
      decision,
      targetId:
        decision.targetId ||
        (decision.classification === 'connector-only' ||
        decision.classification === 'hybrid-one-product'
          ? wallet.id
          : '—'),
    };
  });
  const reviewed = rows.filter((row) => row.decision.reviewStatus === 'reviewed').length;
  const pending = rows.length - reviewed;
  const generatedAt = new Date().toISOString();
  const sourceLabel = path.relative(ROOT, WALLET_PATH).split(path.sep).join('/');
  const markdown = `# Organizational wallet migration dry run

Generated from \`${sourceLabel}\` at ${generatedAt}.

This report is diagnostic only. It does not modify Wallet Catalog source data. The candidate rule is \`type=organizational\` and no explicit \`holder\` capability; classification is never inferred as a migration approval.

## Summary

- Candidates: ${rows.length}
- Manually reviewed exceptions: ${reviewed}
- Pending source review: ${pending}
- Automatic migrations approved: 0

## Decisions

| Source wallet ID | Organization | Classification | Target connector ID | Uncertainty | Review | Reason |
| --- | --- | --- | --- | --- | --- | --- |
${rows
  .map(
    ({ wallet, decision, targetId }) =>
      `| ${escapeCell(wallet.id)} | ${escapeCell(wallet.orgId || 'unknown')} | ${decision.classification} | ${escapeCell(targetId)} | ${decision.uncertainty} | ${decision.reviewStatus} | ${escapeCell(decision.reason)} |`,
  )
  .join('\n')}

## Migration gate

Only rows marked \`reviewed\` may inform a later source-data change. Connector-only removal from Wallet Catalog, Holder capability corrections, and hybrid \`walletRef\` records require separate reviewed changes in their source repositories.
`;
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, markdown);
  console.log(`Wrote ${rows.length} candidates to ${OUTPUT_PATH} (${pending} pending review).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
