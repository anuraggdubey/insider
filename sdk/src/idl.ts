/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `programs/idl/insider.json`.
 */
export type Insider = {
  address: "7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW";
  metadata: {
    name: "insider";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "claimSeat";
      discriminator: [47, 217, 3, 139, 51, 238, 55, 107];
      accounts: [
        {
          name: "owner";
          signer: true;
        },
        {
          name: "table";
        },
        {
          name: "seat";
          writable: true;
        },
      ];
      args: [
        {
          name: "index";
          type: "u8";
        },
      ];
    },
    {
      name: "delegateCallBook";
      discriminator: [35, 182, 175, 37, 5, 56, 1, 237];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "table";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 98, 108, 101];
              },
              {
                kind: "account";
                path: "payer";
              },
            ];
          };
        },
        {
          name: "bufferCallBook";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 117, 102, 102, 101, 114];
              },
              {
                kind: "account";
                path: "callBook";
              },
            ];
            program: {
              kind: "const";
              value: [
                100,
                138,
                19,
                74,
                196,
                109,
                85,
                33,
                73,
                28,
                184,
                108,
                4,
                90,
                142,
                233,
                103,
                187,
                253,
                10,
                187,
                122,
                89,
                9,
                217,
                28,
                57,
                82,
                39,
                210,
                207,
                107,
              ];
            };
          };
        },
        {
          name: "delegationRecordCallBook";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [100, 101, 108, 101, 103, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "callBook";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "delegationMetadataCallBook";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "callBook";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "callBook";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 97, 108, 108, 98, 111, 111, 107];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "ownerProgram";
          address: "7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW";
        },
        {
          name: "delegationProgram";
          address: "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "delegateSeason";
      discriminator: [69, 49, 255, 212, 191, 231, 123, 41];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "table";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 98, 108, 101];
              },
              {
                kind: "account";
                path: "payer";
              },
            ];
          };
        },
        {
          name: "bufferSeason";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 117, 102, 102, 101, 114];
              },
              {
                kind: "account";
                path: "season";
              },
            ];
            program: {
              kind: "const";
              value: [
                100,
                138,
                19,
                74,
                196,
                109,
                85,
                33,
                73,
                28,
                184,
                108,
                4,
                90,
                142,
                233,
                103,
                187,
                253,
                10,
                187,
                122,
                89,
                9,
                217,
                28,
                57,
                82,
                39,
                210,
                207,
                107,
              ];
            };
          };
        },
        {
          name: "delegationRecordSeason";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [100, 101, 108, 101, 103, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "season";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "delegationMetadataSeason";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "season";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "season";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [115, 101, 97, 115, 111, 110];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "ownerProgram";
          address: "7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW";
        },
        {
          name: "delegationProgram";
          address: "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "delegateSeat";
      discriminator: [53, 85, 50, 81, 161, 68, 71, 212];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "table";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 98, 108, 101];
              },
              {
                kind: "account";
                path: "payer";
              },
            ];
          };
        },
        {
          name: "bufferSeat";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 117, 102, 102, 101, 114];
              },
              {
                kind: "account";
                path: "seat";
              },
            ];
            program: {
              kind: "const";
              value: [
                100,
                138,
                19,
                74,
                196,
                109,
                85,
                33,
                73,
                28,
                184,
                108,
                4,
                90,
                142,
                233,
                103,
                187,
                253,
                10,
                187,
                122,
                89,
                9,
                217,
                28,
                57,
                82,
                39,
                210,
                207,
                107,
              ];
            };
          };
        },
        {
          name: "delegationRecordSeat";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [100, 101, 108, 101, 103, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "seat";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "delegationMetadataSeat";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "seat";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "seat";
          writable: true;
        },
        {
          name: "ownerProgram";
          address: "7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW";
        },
        {
          name: "delegationProgram";
          address: "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "index";
          type: "u8";
        },
      ];
    },
    {
      name: "delegateTable";
      discriminator: [161, 66, 67, 113, 58, 219, 238, 170];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "bufferTable";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 117, 102, 102, 101, 114];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
            program: {
              kind: "const";
              value: [
                100,
                138,
                19,
                74,
                196,
                109,
                85,
                33,
                73,
                28,
                184,
                108,
                4,
                90,
                142,
                233,
                103,
                187,
                253,
                10,
                187,
                122,
                89,
                9,
                217,
                28,
                57,
                82,
                39,
                210,
                207,
                107,
              ];
            };
          };
        },
        {
          name: "delegationRecordTable";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [100, 101, 108, 101, 103, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "delegationMetadataTable";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "table";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 98, 108, 101];
              },
              {
                kind: "account";
                path: "payer";
              },
            ];
          };
        },
        {
          name: "ownerProgram";
          address: "7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW";
        },
        {
          name: "delegationProgram";
          address: "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "delegateTape";
      discriminator: [179, 120, 121, 210, 179, 103, 235, 217];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "table";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 98, 108, 101];
              },
              {
                kind: "account";
                path: "payer";
              },
            ];
          };
        },
        {
          name: "bufferTape";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 117, 102, 102, 101, 114];
              },
              {
                kind: "account";
                path: "tape";
              },
            ];
            program: {
              kind: "const";
              value: [
                100,
                138,
                19,
                74,
                196,
                109,
                85,
                33,
                73,
                28,
                184,
                108,
                4,
                90,
                142,
                233,
                103,
                187,
                253,
                10,
                187,
                122,
                89,
                9,
                217,
                28,
                57,
                82,
                39,
                210,
                207,
                107,
              ];
            };
          };
        },
        {
          name: "delegationRecordTape";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [100, 101, 108, 101, 103, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "tape";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "delegationMetadataTape";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "tape";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "tape";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 112, 101];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "ownerProgram";
          address: "7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW";
        },
        {
          name: "delegationProgram";
          address: "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "initCallBook";
      discriminator: [101, 221, 116, 40, 21, 29, 243, 44];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
          relations: ["table"];
        },
        {
          name: "table";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 98, 108, 101];
              },
              {
                kind: "account";
                path: "authority";
              },
            ];
          };
        },
        {
          name: "callBook";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 97, 108, 108, 98, 111, 111, 107];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "initSeason";
      discriminator: [179, 47, 101, 197, 114, 97, 174, 98];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
          relations: ["table"];
        },
        {
          name: "table";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 98, 108, 101];
              },
              {
                kind: "account";
                path: "authority";
              },
            ];
          };
        },
        {
          name: "season";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [115, 101, 97, 115, 111, 110];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "initSeat";
      discriminator: [239, 28, 83, 94, 20, 162, 99, 60];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
          relations: ["table"];
        },
        {
          name: "table";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 98, 108, 101];
              },
              {
                kind: "account";
                path: "authority";
              },
            ];
          };
        },
        {
          name: "seat";
          writable: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "index";
          type: "u8";
        },
      ];
    },
    {
      name: "initTable";
      discriminator: [236, 14, 14, 155, 160, 169, 133, 111];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "table";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 98, 108, 101];
              },
              {
                kind: "account";
                path: "authority";
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "params";
          type: {
            option: {
              defined: {
                name: "params";
              };
            };
          };
        },
      ];
    },
    {
      name: "initTape";
      discriminator: [50, 35, 14, 18, 196, 59, 71, 181];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
          relations: ["table"];
        },
        {
          name: "table";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 98, 108, 101];
              },
              {
                kind: "account";
                path: "authority";
              },
            ];
          };
        },
        {
          name: "tape";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 112, 101];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "ping";
      discriminator: [173, 0, 94, 236, 73, 133, 225, 153];
      accounts: [
        {
          name: "owner";
          signer: true;
        },
        {
          name: "table";
        },
        {
          name: "seat";
          writable: true;
        },
      ];
      args: [
        {
          name: "index";
          type: "u8";
        },
      ];
    },
    {
      name: "processUndelegation";
      discriminator: [196, 28, 41, 206, 48, 37, 51, 167];
      accounts: [
        {
          name: "baseAccount";
          writable: true;
        },
        {
          name: "buffer";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  117,
                  110,
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  101,
                  45,
                  98,
                  117,
                  102,
                  102,
                  101,
                  114,
                ];
              },
              {
                kind: "account";
                path: "baseAccount";
              },
            ];
            program: {
              kind: "const";
              value: [
                181,
                183,
                0,
                225,
                242,
                87,
                58,
                192,
                204,
                6,
                34,
                1,
                52,
                74,
                207,
                151,
                184,
                53,
                6,
                235,
                140,
                229,
                25,
                152,
                204,
                98,
                126,
                24,
                147,
                128,
                167,
                62,
              ];
            };
          };
        },
        {
          name: "payer";
          writable: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "accountSeeds";
          type: {
            vec: "bytes";
          };
        },
      ];
    },
    {
      name: "rearmTicks";
      discriminator: [19, 253, 85, 36, 156, 154, 64, 63];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "table";
          docs: ["after the scheduler CPI."];
          writable: true;
        },
        {
          name: "magicProgram";
          address: "Magic11111111111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "taskId";
          type: "i64";
        },
        {
          name: "intervalMillis";
          type: "i64";
        },
        {
          name: "iterations";
          type: "i64";
        },
      ];
    },
    {
      name: "scheduleTicks";
      discriminator: [243, 206, 0, 155, 207, 136, 85, 251];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "table";
          docs: ["after the scheduler CPI."];
          writable: true;
        },
        {
          name: "magicProgram";
          address: "Magic11111111111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "taskId";
          type: "i64";
        },
        {
          name: "intervalMillis";
          type: "i64";
        },
        {
          name: "iterations";
          type: "i64";
        },
      ];
    },
    {
      name: "sendOrder";
      discriminator: [106, 200, 215, 170, 187, 32, 105, 150];
      accounts: [
        {
          name: "owner";
          signer: true;
        },
        {
          name: "table";
        },
        {
          name: "seat";
          writable: true;
        },
        {
          name: "market";
        },
        {
          name: "mempool";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 101, 109, 112, 111, 111, 108];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "tape";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 112, 101];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "index";
          type: "u8";
        },
        {
          name: "sideSize";
          type: "i16";
        },
        {
          name: "lane";
          type: "u8";
        },
      ];
    },
    {
      name: "tick";
      discriminator: [92, 79, 44, 8, 101, 80, 63, 15];
      accounts: [
        {
          name: "table";
          writable: true;
        },
        {
          name: "scheduler";
          docs: [
            "The account that scheduled the crank task. Any key may schedule (`rearm_ticks` is",
            "permissionless); the signer below proves the call came from the scheduler.",
          ];
        },
        {
          name: "crankSigner";
          signer: true;
        },
      ];
      args: [];
    },
  ];
  accounts: [
    {
      name: "callBook";
      discriminator: [52, 34, 142, 98, 147, 247, 104, 191];
    },
    {
      name: "market";
      discriminator: [219, 190, 213, 55, 0, 227, 198, 154];
    },
    {
      name: "mempool";
      discriminator: [52, 86, 190, 94, 227, 116, 179, 12];
    },
    {
      name: "season";
      discriminator: [76, 67, 93, 156, 180, 157, 248, 47];
    },
    {
      name: "seat";
      discriminator: [90, 228, 22, 90, 162, 86, 173, 26];
    },
    {
      name: "table";
      discriminator: [34, 100, 138, 97, 236, 129, 230, 112];
    },
    {
      name: "tape";
      discriminator: [60, 19, 137, 0, 97, 74, 23, 131];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "overflow";
      msg: "Arithmetic overflow";
    },
    {
      code: 6001;
      name: "wrongPhase";
      msg: "The table is not in the phase this instruction needs";
    },
    {
      code: 6002;
      name: "invalidSeat";
      msg: "Seat index must be 0-9";
    },
    {
      code: 6003;
      name: "seatTaken";
      msg: "The seat is taken and cannot be displaced";
    },
    {
      code: 6004;
      name: "notSeatOwner";
      msg: "Only the seat owner may do this";
    },
    {
      code: 6005;
      name: "notAuthority";
      msg: "Only the table authority may do this";
    },
    {
      code: 6006;
      name: "vrfPending";
      msg: "A VRF request is already pending";
    },
    {
      code: 6007;
      name: "noVrfPending";
      msg: "No VRF request is pending";
    },
    {
      code: 6008;
      name: "vrfNotTimedOut";
      msg: "The VRF request has not timed out yet";
    },
    {
      code: 6009;
      name: "staleVrfCallback";
      msg: "The callback does not match the pending request";
    },
    {
      code: 6010;
      name: "tooManyMembers";
      msg: "Too many permission members";
    },
    {
      code: 6011;
      name: "notRearmable";
      msg: "The crank is still armed; nothing to re-arm";
    },
    {
      code: 6012;
      name: "orderTooLarge";
      msg: "Order is too large";
    },
    {
      code: 6013;
      name: "positionLimit";
      msg: "Position limit exceeded";
    },
    {
      code: 6014;
      name: "tooManyPending";
      msg: "Too many pending orders";
    },
    {
      code: 6015;
      name: "mempoolFull";
      msg: "Mempool is full";
    },
    {
      code: 6016;
      name: "zeroOrder";
      msg: "Order size is zero";
    },
    {
      code: 6017;
      name: "invalidLane";
      msg: "Invalid lane";
    },
    {
      code: 6018;
      name: "notForSale";
      msg: "Leak is not for sale";
    },
    {
      code: 6019;
      name: "auctionOver";
      msg: "Auction is over";
    },
    {
      code: 6020;
      name: "insufficientChips";
      msg: "Insufficient chips";
    },
    {
      code: 6021;
      name: "notLeakOwner";
      msg: "Not the leak owner";
    },
    {
      code: 6022;
      name: "alreadyOpened";
      msg: "Leak already opened";
    },
    {
      code: 6023;
      name: "hoardLimit";
      msg: "Unopened leak limit exceeded";
    },
    {
      code: 6024;
      name: "invalidLeakSlot";
      msg: "Invalid leak slot";
    },
    {
      code: 6025;
      name: "readerLimit";
      msg: "Reader limit exceeded";
    },
    {
      code: 6026;
      name: "liquidated";
      msg: "Seat is liquidated";
    },
  ];
  types: [
    {
      name: "analystStats";
      docs: ["Track record of one analyst seat, judged by the oracle (public, on chain)."];
      type: {
        kind: "struct";
        fields: [
          {
            name: "calls";
            type: "u32";
          },
          {
            name: "hits";
            type: "u32";
          },
          {
            name: "streak";
            type: "u16";
          },
          {
            name: "bestStreak";
            type: "u16";
          },
          {
            name: "profit";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "callBook";
      docs: ["One Call per seat."];
      serialization: "bytemuck";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "headers";
            type: {
              array: [
                {
                  defined: {
                    name: "callHeader";
                  };
                },
                10,
              ];
            };
          },
          {
            name: "nextCallId";
            type: "u32";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "pad";
            type: {
              array: ["u8", 3];
            };
          },
        ];
      };
    },
    {
      name: "callHeader";
      docs: [
        "Public header of a Desk Call; the direction and confidence stay in the private `CallVault`",
        "until settlement reveals the direction. Zero-copy: the call book is 1.8 KB, too big for the",
        "4 KB SBF stack frame when deserialised the normal way.",
      ];
      serialization: "bytemuck";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "callId";
            type: "u32";
          },
          {
            name: "authorSeat";
            type: "u8";
          },
          {
            name: "state";
            docs: ["`CallState` as a byte."];
            type: "u8";
          },
          {
            name: "revealedDir";
            docs: ["Revealed direction after settlement: +1 up, -1 down, 0 not revealed."];
            type: "i8";
          },
          {
            name: "pad0";
            type: "u8";
          },
          {
            name: "mintedTs";
            type: "i64";
          },
          {
            name: "mintedPrice";
            docs: ["Oracle price at mint, fixed point 1e6 (decoded with the feed-list exponent)."];
            type: "u64";
          },
          {
            name: "horizonSecs";
            type: "u16";
          },
          {
            name: "pad1";
            type: {
              array: ["u8", 6];
            };
          },
          {
            name: "expiryTs";
            type: "i64";
          },
          {
            name: "stake";
            type: "u64";
          },
          {
            name: "licenseAsk";
            type: "u64";
          },
          {
            name: "readers";
            type: {
              array: ["pubkey", 4];
            };
          },
        ];
      };
    },
    {
      name: "dropSpec";
      serialization: "bytemuck";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "tick";
            type: "u16";
          },
          {
            name: "kind";
            type: "u8";
          },
          {
            name: "rarity";
            type: "u8";
          },
          {
            name: "windowOffset";
            type: "u8";
          },
          {
            name: "windowLen";
            type: "u8";
          },
          {
            name: "pad";
            type: {
              array: ["u8", 2];
            };
          },
        ];
      };
    },
    {
      name: "fill";
      docs: ["A fill executed against the vAMM (public by design)."];
      type: {
        kind: "struct";
        fields: [
          {
            name: "seat";
            docs: ["255 = whale."];
            type: "u8";
          },
          {
            name: "side";
            docs: ["+1 buy, -1 sell."];
            type: "i8";
          },
          {
            name: "size";
            type: "u16";
          },
          {
            name: "price";
            docs: ["Average fill price, fixed point 1e6."];
            type: "u32";
          },
          {
            name: "landedTick";
            type: "u16";
          },
        ];
      };
    },
    {
      name: "market";
      docs: ["Public Floor or Desk market."];
      serialization: "bytemuck";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "roundId";
            type: "u32";
          },
          {
            name: "kind";
            type: "u8";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "lastTick";
            type: "u16";
          },
          {
            name: "base";
            type: "u64";
          },
          {
            name: "quote";
            type: "u64";
          },
          {
            name: "price";
            type: "u32";
          },
          {
            name: "markPrice";
            type: "u32";
          },
          {
            name: "oracleTs";
            type: "i64";
          },
          {
            name: "volume";
            type: "u64";
          },
          {
            name: "history";
            type: {
              array: ["u32", 192];
            };
          },
          {
            name: "liquidatedMask";
            type: "u16";
          },
          {
            name: "pad";
            type: {
              array: ["u8", 6];
            };
          },
        ];
      };
    },
    {
      name: "mempool";
      docs: ["Private order queue and drop schedule."];
      serialization: "bytemuck";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "roundId";
            type: "u32";
          },
          {
            name: "nextSeq";
            type: "u16";
          },
          {
            name: "count";
            type: "u8";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "orders";
            type: {
              array: [
                {
                  defined: {
                    name: "pendingOrder";
                  };
                },
                48,
              ];
            };
          },
          {
            name: "drops";
            type: {
              array: [
                {
                  defined: {
                    name: "dropSpec";
                  };
                },
                8,
              ];
            };
          },
        ];
      };
    },
    {
      name: "params";
      docs: [
        "Market parameters the engine reads (spec sections 7.1-7.2). Stored on `Table` so gate E1 can",
        "tune them without a program change.",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "arbBps";
            docs: [
              "Arbitrage pull per tick toward the fundamental, in basis points (start 400 = 4%).",
            ];
            type: "u16";
          },
          {
            name: "feeBps";
            docs: ["Trading fee in basis points (10 = 0.1%)."];
            type: "u16";
          },
          {
            name: "priorityFee";
            docs: ["Priority-lane fee in chips."];
            type: "u32";
          },
          {
            name: "standardDelay";
            docs: ["Ticks until a standard order lands."];
            type: "u8";
          },
          {
            name: "priorityDelay";
            docs: ["Ticks until a priority order lands."];
            type: "u8";
          },
          {
            name: "maxOrderUnits";
            docs: ["Largest order in units."];
            type: "u16";
          },
          {
            name: "maxPositionUnits";
            docs: ["Largest absolute position in units."];
            type: "u16";
          },
          {
            name: "maxPending";
            docs: ["Most pending orders per seat."];
            type: "u8";
          },
          {
            name: "vammBase";
            docs: ["Virtual reserves reset every round."];
            type: "u64";
          },
          {
            name: "vammQuote";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "pendingOrder";
      serialization: "bytemuck";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "seat";
            type: "u8";
          },
          {
            name: "lane";
            type: "u8";
          },
          {
            name: "sideSize";
            type: "i16";
          },
          {
            name: "landTick";
            type: "u16";
          },
          {
            name: "seq";
            type: "u16";
          },
        ];
      };
    },
    {
      name: "phase";
      docs: [
        "Round phase. `Live` accepts orders; `Closing` drains the mempool and closes positions.",
      ];
      type: {
        kind: "enum";
        variants: [
          {
            name: "idle";
          },
          {
            name: "seeding";
          },
          {
            name: "live";
          },
          {
            name: "closing";
          },
          {
            name: "xray";
          },
        ];
      };
    },
    {
      name: "scoreEntry";
      type: {
        kind: "struct";
        fields: [
          {
            name: "owner";
            type: "pubkey";
          },
          {
            name: "score";
            type: "i64";
          },
          {
            name: "rounds";
            type: "u16";
          },
        ];
      };
    },
    {
      name: "season";
      docs: [
        "Epoch state, delegated and committed separately from the table accounts (spec section 6).",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "epoch";
            type: "u32";
          },
          {
            name: "roundsPlayed";
            type: "u32";
          },
          {
            name: "leaderboard";
            docs: ["Best scores of the epoch, highest first; empty slots have a default owner."];
            type: {
              array: [
                {
                  defined: {
                    name: "scoreEntry";
                  };
                },
                20,
              ];
            };
          },
          {
            name: "analysts";
            type: {
              array: [
                {
                  defined: {
                    name: "analystStats";
                  };
                },
                10,
              ];
            };
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "seat";
      docs: [
        "One of the ten seats. Public: owner, chips, position and activity are visible to everyone.",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "index";
            docs: ["Seat number 0-9 (also in the PDA seeds)."];
            type: "u8";
          },
          {
            name: "owner";
            docs: [
              "Wallet or guest key that holds the seat; the default key means the seat is free.",
            ];
            type: "pubkey";
          },
          {
            name: "nameIdx";
            docs: ["Index into the fixed name list (no free text on chain)."];
            type: "u8";
          },
          {
            name: "kind";
            type: {
              defined: {
                name: "seatKind";
              };
            };
          },
          {
            name: "chips";
            type: "i64";
          },
          {
            name: "position";
            docs: ["Signed position in units."];
            type: "i32";
          },
          {
            name: "entry";
            docs: ["Average entry price, fixed point 1e6."];
            type: "u64";
          },
          {
            name: "feesPaid";
            type: "u64";
          },
          {
            name: "leakSpend";
            type: "u64";
          },
          {
            name: "pendingCount";
            type: "u8";
          },
          {
            name: "deskChips";
            type: "i64";
          },
          {
            name: "deskPosition";
            type: "i32";
          },
          {
            name: "lastSeenTick";
            type: "u16";
          },
          {
            name: "claims";
            docs: ["How many times the seat has been claimed."];
            type: "u32";
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "seatKind";
      type: {
        kind: "enum";
        variants: [
          {
            name: "bot";
          },
          {
            name: "ai";
          },
          {
            name: "human";
          },
        ];
      };
    },
    {
      name: "sendEvent";
      docs: [
        "Public trace of an order being sent: who, in which lane, when. The order's side and size are",
        "never here; they live in the private mempool.",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "seat";
            type: "u8";
          },
          {
            name: "lane";
            docs: ["0 = standard, 1 = priority."];
            type: "u8";
          },
          {
            name: "sentTick";
            type: "u16";
          },
        ];
      };
    },
    {
      name: "table";
      docs: [
        "The one public table account: who runs it, which round and phase, and the automation state.",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "authority";
            type: "pubkey";
          },
          {
            name: "epoch";
            type: "u32";
          },
          {
            name: "roundId";
            type: "u32";
          },
          {
            name: "phase";
            type: {
              defined: {
                name: "phase";
              };
            };
          },
          {
            name: "roundStartSlot";
            docs: ["Rollup slot at which tick 0 of the current round began."];
            type: "u64";
          },
          {
            name: "tick";
            docs: ["Last tick processed in this round (see `SLOTS_PER_TICK`)."];
            type: "u16";
          },
          {
            name: "armedUntilSlot";
            docs: ["Slot at which the scheduled crank stops; `rearm_ticks` extends it."];
            type: "u64";
          },
          {
            name: "vrfNonce";
            docs: [
              "Incremented per VRF request so a late callback for an old request is rejected.",
            ];
            type: "u32";
          },
          {
            name: "vrfPending";
            type: "bool";
          },
          {
            name: "vrfRequestedTick";
            docs: ["Tick at which the pending VRF request was made (for `cancel_vrf`)."];
            type: "u16";
          },
          {
            name: "roundsThisEpoch";
            type: "u32";
          },
          {
            name: "params";
            type: {
              defined: {
                name: "params";
              };
            };
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "tape";
      docs: [
        "Two fixed ring buffers; `*_head` counts every push, so the newest entry is at",
        "`(head - 1) % RING`.",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "sends";
            type: {
              array: [
                {
                  defined: {
                    name: "sendEvent";
                  };
                },
                64,
              ];
            };
          },
          {
            name: "sendsHead";
            type: "u32";
          },
          {
            name: "fills";
            type: {
              array: [
                {
                  defined: {
                    name: "fill";
                  };
                },
                64,
              ];
            };
          },
          {
            name: "fillsHead";
            type: "u32";
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
  ];
};
