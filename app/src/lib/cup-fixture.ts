import type { CupData, CupStatus } from "./cup";

export function fixtureCup(settled: boolean): { cup: CupData; operator: CupStatus } {
  const entries = [
    {
      name: "Brave Stoat",
      owner: "FixturePlayer111111111111111111111111111111",
      seat: 7,
      score: 320,
    },
    {
      name: "Still Panther",
      owner: "FixturePlayer222222222222222222222222222222",
      seat: 8,
      score: 180,
    },
    {
      name: "Quiet Heron",
      owner: "FixturePlayer333333333333333333333333333333",
      seat: 9,
      score: -45,
    },
  ];
  return {
    cup: {
      cupId: settled ? 2 : 3,
      roundsRecorded: settled ? 5 : 0,
      settled,
      entrants: 3,
      entries,
      winners: settled
        ? entries.map((entry, i) => ({
            owner: entry.owner,
            name: entry.name,
            bps: [5000, 3000, 2000][i]!,
          }))
        : [],
    },
    operator: {
      cupId: settled ? 2 : 3,
      open: !settled,
      roundsRecorded: settled ? 5 : 0,
      settled,
      entrants: 3,
      credits: 0,
      buyIn: "10000000",
      feeBps: 500,
      mint: "11111111111111111111111111111111",
      operator: "11111111111111111111111111111111",
      history: settled
        ? [
            {
              cup: 2,
              entrants: 3,
              pot: "30000000",
              fee: "1500000",
              closed: "fixture",
              prizes: entries.map((entry, i) => ({
                to: entry.owner,
                amount: ["14250000", "8550000", "5700000"][i]!,
                signature: "fixture",
              })),
            },
          ]
        : [],
    },
  };
}
