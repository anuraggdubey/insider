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
      name: "bid";
      discriminator: [199, 56, 85, 38, 146, 243, 37, 158];
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
          name: "board";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 114, 100];
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
          name: "slot";
          type: "u8";
        },
      ];
    },
    {
      name: "buyCallLicense";
      discriminator: [235, 182, 237, 251, 248, 111, 60, 56];
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
          name: "authorSeat";
          writable: true;
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
          name: "vault";
          writable: true;
        },
        {
          name: "permission";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 101, 114, 109, 105, 115, 115, 105, 111, 110, 58];
              },
              {
                kind: "account";
                path: "vault";
              },
            ];
            program: {
              kind: "account";
              path: "permissionProgram";
            };
          };
        },
        {
          name: "permissionProgram";
          address: "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1";
        },
        {
          name: "ephemeralVault";
          writable: true;
          address: "MagicVau1t999999999999999999999999999999999";
        },
        {
          name: "magicProgram";
          address: "Magic11111111111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "index";
          type: "u8";
        },
        {
          name: "authorIndex";
          type: "u8";
        },
      ];
    },
    {
      name: "buyLicense";
      discriminator: [255, 81, 129, 152, 169, 201, 232, 105];
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
          name: "board";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 114, 100];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "licenseOwner";
          writable: true;
        },
        {
          name: "vault";
          writable: true;
        },
        {
          name: "permission";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 101, 114, 109, 105, 115, 115, 105, 111, 110, 58];
              },
              {
                kind: "account";
                path: "vault";
              },
            ];
            program: {
              kind: "account";
              path: "permissionProgram";
            };
          };
        },
        {
          name: "permissionProgram";
          address: "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1";
        },
        {
          name: "ephemeralVault";
          writable: true;
          address: "MagicVau1t999999999999999999999999999999999";
        },
        {
          name: "magicProgram";
          address: "Magic11111111111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "index";
          type: "u8";
        },
        {
          name: "slot";
          type: "u8";
        },
        {
          name: "ownerIndex";
          type: "u8";
        },
      ];
    },
    {
      name: "buyListed";
      discriminator: [75, 236, 50, 95, 167, 79, 50, 201];
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
          name: "board";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 114, 100];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "sellerSeat";
          writable: true;
        },
      ];
      args: [
        {
          name: "index";
          type: "u8";
        },
        {
          name: "slot";
          type: "u8";
        },
        {
          name: "sellerIndex";
          type: "u8";
        },
      ];
    },
    {
      name: "cancelVrf";
      discriminator: [133, 1, 179, 53, 161, 166, 208, 207];
      accounts: [
        {
          name: "payer";
          signer: true;
        },
        {
          name: "table";
          writable: true;
        },
      ];
      args: [];
    },
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
      name: "commitEpoch";
      discriminator: [140, 0, 62, 186, 73, 180, 201, 179];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "table";
          writable: true;
        },
        {
          name: "xray";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [120, 114, 97, 121];
              },
              {
                kind: "account";
                path: "table";
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
          name: "magicProgram";
          address: "Magic11111111111111111111111111111111111111";
        },
        {
          name: "magicContext";
          writable: true;
          address: "MagicContext1111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "cupClose";
      discriminator: [16, 223, 231, 38, 161, 1, 39, 34];
      accounts: [
        {
          name: "operator";
          signer: true;
        },
        {
          name: "table";
        },
        {
          name: "cup";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 117, 112];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
      ];
      args: [];
    },
    {
      name: "cupJoin";
      discriminator: [176, 178, 245, 199, 214, 167, 226, 159];
      accounts: [
        {
          name: "owner";
          signer: true;
        },
        {
          name: "operator";
          docs: ["The operator: the table authority, who confirmed the buy-in."];
          signer: true;
        },
        {
          name: "table";
        },
        {
          name: "seat";
        },
        {
          name: "cup";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 117, 112];
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
      ];
    },
    {
      name: "cupRecord";
      discriminator: [122, 112, 255, 126, 222, 97, 52, 236];
      accounts: [
        {
          name: "payer";
          signer: true;
        },
        {
          name: "table";
        },
        {
          name: "xray";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [120, 114, 97, 121];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "cup";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 117, 112];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
      ];
      args: [];
    },
    {
      name: "cupSettle";
      discriminator: [142, 246, 225, 25, 197, 44, 86, 29];
      accounts: [
        {
          name: "payer";
          signer: true;
        },
        {
          name: "table";
        },
        {
          name: "cup";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 117, 112];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
      ];
      args: [];
    },
    {
      name: "delegateBoard";
      discriminator: [111, 167, 6, 152, 230, 48, 8, 91];
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
          name: "bufferBoard";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 117, 102, 102, 101, 114];
              },
              {
                kind: "account";
                path: "board";
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
          name: "delegationRecordBoard";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [100, 101, 108, 101, 103, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "board";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "delegationMetadataBoard";
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
                path: "board";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "board";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 114, 100];
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
      name: "delegateCallVault";
      discriminator: [219, 8, 69, 56, 28, 51, 43, 203];
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
          name: "bufferVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 117, 102, 102, 101, 114];
              },
              {
                kind: "account";
                path: "vault";
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
          name: "delegationRecordVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [100, 101, 108, 101, 103, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "vault";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "delegationMetadataVault";
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
                path: "vault";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "vault";
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
          name: "slot";
          type: "u8";
        },
      ];
    },
    {
      name: "delegateCup";
      discriminator: [96, 167, 92, 49, 185, 18, 114, 118];
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
          name: "bufferCup";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 117, 102, 102, 101, 114];
              },
              {
                kind: "account";
                path: "cup";
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
          name: "delegationRecordCup";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [100, 101, 108, 101, 103, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "cup";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "delegationMetadataCup";
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
                path: "cup";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "cup";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 117, 112];
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
      name: "delegateFuture";
      discriminator: [63, 77, 104, 62, 230, 169, 72, 166];
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
          name: "bufferFuture";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 117, 102, 102, 101, 114];
              },
              {
                kind: "account";
                path: "future";
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
          name: "delegationRecordFuture";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [100, 101, 108, 101, 103, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "future";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "delegationMetadataFuture";
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
                path: "future";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "future";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [102, 117, 116, 117, 114, 101];
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
      name: "delegateLeakVault";
      discriminator: [168, 185, 82, 228, 213, 170, 38, 21];
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
          name: "bufferVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 117, 102, 102, 101, 114];
              },
              {
                kind: "account";
                path: "vault";
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
          name: "delegationRecordVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [100, 101, 108, 101, 103, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "vault";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "delegationMetadataVault";
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
                path: "vault";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "vault";
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
          name: "slot";
          type: "u8";
        },
      ];
    },
    {
      name: "delegateMarket";
      discriminator: [223, 125, 110, 148, 99, 176, 143, 72];
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
          name: "bufferMarket";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 117, 102, 102, 101, 114];
              },
              {
                kind: "account";
                path: "market";
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
          name: "delegationRecordMarket";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [100, 101, 108, 101, 103, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "market";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "delegationMetadataMarket";
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
                path: "market";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "market";
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
          name: "kind";
          type: "u8";
        },
      ];
    },
    {
      name: "delegateMempool";
      discriminator: [9, 177, 63, 112, 230, 102, 122, 214];
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
          name: "bufferMempool";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 117, 102, 102, 101, 114];
              },
              {
                kind: "account";
                path: "mempool";
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
          name: "delegationRecordMempool";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [100, 101, 108, 101, 103, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "mempool";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "delegationMetadataMempool";
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
                path: "mempool";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
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
      name: "delegateXray";
      discriminator: [113, 181, 65, 86, 134, 236, 16, 218];
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
          name: "bufferXray";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 117, 102, 102, 101, 114];
              },
              {
                kind: "account";
                path: "xray";
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
          name: "delegationRecordXray";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [100, 101, 108, 101, 103, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "xray";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "delegationMetadataXray";
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
                path: "xray";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "xray";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [120, 114, 97, 121];
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
      name: "deskTrade";
      discriminator: [179, 183, 95, 239, 152, 236, 145, 252];
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
          writable: true;
        },
        {
          name: "oracle";
          address: "ENYwebBThHzmzwPLAQvCucUTsjyfBSZdD9ViXksS4jPu";
        },
      ];
      args: [
        {
          name: "index";
          type: "u8";
        },
        {
          name: "size";
          type: "i16";
        },
      ];
    },
    {
      name: "finishRound";
      discriminator: [23, 104, 163, 186, 110, 225, 11, 242];
      accounts: [
        {
          name: "payer";
          signer: true;
        },
        {
          name: "table";
        },
        {
          name: "board";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 114, 100];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "xray";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [120, 114, 97, 121];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "seat0";
          writable: true;
        },
        {
          name: "seat1";
          writable: true;
        },
        {
          name: "seat2";
          writable: true;
        },
        {
          name: "seat3";
          writable: true;
        },
        {
          name: "seat4";
          writable: true;
        },
        {
          name: "seat5";
          writable: true;
        },
        {
          name: "seat6";
          writable: true;
        },
        {
          name: "seat7";
          writable: true;
        },
        {
          name: "seat8";
          writable: true;
        },
        {
          name: "seat9";
          writable: true;
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
          name: "vault0";
        },
        {
          name: "vault1";
        },
        {
          name: "vault2";
        },
        {
          name: "vault3";
        },
        {
          name: "vault4";
        },
        {
          name: "vault5";
        },
      ];
      args: [];
    },
    {
      name: "initBoard";
      discriminator: [99, 74, 129, 223, 26, 254, 94, 217];
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
          name: "board";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 114, 100];
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
      name: "initCallVault";
      discriminator: [5, 62, 60, 184, 146, 93, 15, 57];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "table";
          docs: ["layer; its seeds tie it to `authority`, which is what the old `has_one` proved."];
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
          name: "vault";
          writable: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "slot";
          type: "u8";
        },
      ];
    },
    {
      name: "initCup";
      discriminator: [195, 113, 77, 240, 182, 192, 177, 37];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "table";
          docs: ["its seeds tie it to `authority`."];
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
          name: "cup";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 117, 112];
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
      name: "initFuture";
      discriminator: [133, 160, 199, 213, 163, 124, 138, 69];
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
          name: "future";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [102, 117, 116, 117, 114, 101];
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
      name: "initLeakVault";
      discriminator: [134, 132, 27, 73, 132, 36, 111, 26];
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
          name: "vault";
          writable: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "slot";
          type: "u8";
        },
      ];
    },
    {
      name: "initMarket";
      discriminator: [33, 253, 15, 116, 89, 25, 127, 236];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "table";
          docs: ["layer; its seeds tie it to `authority`, which is what the old `has_one` proved."];
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
          name: "market";
          writable: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "kind";
          type: "u8";
        },
      ];
    },
    {
      name: "initMempool";
      discriminator: [64, 29, 80, 152, 234, 209, 210, 154];
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
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "initPermission";
      discriminator: [66, 14, 153, 250, 187, 36, 179, 236];
      accounts: [
        {
          name: "authority";
          signer: true;
          relations: ["table"];
        },
        {
          name: "table";
        },
        {
          name: "target";
          writable: true;
        },
        {
          name: "permission";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 101, 114, 109, 105, 115, 115, 105, 111, 110, 58];
              },
              {
                kind: "account";
                path: "target";
              },
            ];
            program: {
              kind: "account";
              path: "permissionProgram";
            };
          };
        },
        {
          name: "permissionProgram";
          address: "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1";
        },
        {
          name: "ephemeralVault";
          writable: true;
          address: "MagicVau1t999999999999999999999999999999999";
        },
        {
          name: "magicProgram";
          address: "Magic11111111111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "target";
          type: "u8";
        },
        {
          name: "slot";
          type: "u8";
        },
      ];
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
      name: "initXray";
      discriminator: [177, 142, 117, 200, 75, 241, 241, 115];
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
          name: "xray";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [120, 114, 97, 121];
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
      name: "listLeak";
      discriminator: [196, 50, 174, 101, 144, 87, 37, 28];
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
          name: "board";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 114, 100];
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
          name: "slot";
          type: "u8";
        },
        {
          name: "ask";
          type: "u32";
        },
      ];
    },
    {
      name: "mintCall";
      discriminator: [151, 77, 187, 126, 171, 240, 56, 1];
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
          name: "vault";
          writable: true;
        },
        {
          name: "permission";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 101, 114, 109, 105, 115, 115, 105, 111, 110, 58];
              },
              {
                kind: "account";
                path: "vault";
              },
            ];
            program: {
              kind: "account";
              path: "permissionProgram";
            };
          };
        },
        {
          name: "permissionProgram";
          address: "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1";
        },
        {
          name: "ephemeralVault";
          writable: true;
          address: "MagicVau1t999999999999999999999999999999999";
        },
        {
          name: "magicProgram";
          address: "Magic11111111111111111111111111111111111111";
        },
        {
          name: "oracle";
          address: "ENYwebBThHzmzwPLAQvCucUTsjyfBSZdD9ViXksS4jPu";
        },
      ];
      args: [
        {
          name: "index";
          type: "u8";
        },
        {
          name: "direction";
          type: "i8";
        },
        {
          name: "horizon";
          type: "u16";
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
          name: "confidence";
          type: "u8";
        },
      ];
    },
    {
      name: "offerLicense";
      discriminator: [228, 168, 148, 84, 48, 180, 80, 211];
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
          name: "board";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 114, 100];
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
          name: "slot";
          type: "u8";
        },
        {
          name: "ask";
          type: "u32";
        },
      ];
    },
    {
      name: "openEpoch";
      discriminator: [75, 57, 218, 33, 173, 254, 207, 136];
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
      name: "openLeak";
      discriminator: [205, 164, 100, 169, 16, 51, 221, 121];
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
          name: "board";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 114, 100];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "vault";
          writable: true;
        },
        {
          name: "permission";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 101, 114, 109, 105, 115, 115, 105, 111, 110, 58];
              },
              {
                kind: "account";
                path: "vault";
              },
            ];
            program: {
              kind: "account";
              path: "permissionProgram";
            };
          };
        },
        {
          name: "permissionProgram";
          address: "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1";
        },
        {
          name: "ephemeralVault";
          writable: true;
          address: "MagicVau1t999999999999999999999999999999999";
        },
        {
          name: "magicProgram";
          address: "Magic11111111111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "index";
          type: "u8";
        },
        {
          name: "slot";
          type: "u8";
        },
      ];
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
      name: "requestRoundSeed";
      discriminator: [228, 76, 146, 186, 12, 30, 244, 166];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "table";
          writable: true;
        },
        {
          name: "board";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 114, 100];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "xray";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [120, 114, 97, 121];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "market";
        },
        {
          name: "mempool";
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
          name: "future";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [102, 117, 116, 117, 114, 101];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "oracleQueue";
          writable: true;
        },
        {
          name: "programIdentity";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [105, 100, 101, 110, 116, 105, 116, 121];
              },
            ];
          };
        },
        {
          name: "vrfProgram";
          address: "Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz";
        },
        {
          name: "slotHashes";
          address: "SysvarS1otHashes111111111111111111111111111";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "resealLeaks";
      discriminator: [17, 35, 11, 191, 25, 211, 239, 131];
      accounts: [
        {
          name: "payer";
          signer: true;
        },
        {
          name: "table";
        },
        {
          name: "board";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 114, 100];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "xray";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [120, 114, 97, 121];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "permissionProgram";
          address: "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1";
        },
        {
          name: "ephemeralVault";
          writable: true;
          address: "MagicVau1t999999999999999999999999999999999";
        },
        {
          name: "magicProgram";
          address: "Magic11111111111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "slotFrom";
          type: "u8";
        },
        {
          name: "slotTo";
          type: "u8";
        },
      ];
    },
    {
      name: "roundSeedCallback";
      discriminator: [168, 118, 14, 48, 47, 43, 151, 37];
      accounts: [
        {
          name: "vrfProgramIdentity";
          signer: true;
          address: "GSpmeHVR2ZmJpxuv4aWr9yyFRjTS4y5wahZMhbUD6caU";
        },
        {
          name: "table";
          writable: true;
        },
        {
          name: "market";
          writable: true;
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
          name: "future";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [102, 117, 116, 117, 114, 101];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "board";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 114, 100];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "xray";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [120, 114, 97, 121];
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
          name: "randomness";
          type: {
            array: ["u8", 32];
          };
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
      name: "settleCall";
      discriminator: [58, 230, 6, 58, 104, 245, 154, 227];
      accounts: [
        {
          name: "payer";
          signer: true;
        },
        {
          name: "table";
        },
        {
          name: "authorSeat";
          writable: true;
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
          name: "vault";
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
          name: "oracle";
          address: "ENYwebBThHzmzwPLAQvCucUTsjyfBSZdD9ViXksS4jPu";
        },
      ];
      args: [
        {
          name: "authorIndex";
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
        {
          name: "market";
          writable: true;
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
          name: "future";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [102, 117, 116, 117, 114, 101];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "board";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 111, 97, 114, 100];
              },
              {
                kind: "account";
                path: "table";
              },
            ];
          };
        },
        {
          name: "xray";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [120, 114, 97, 121];
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
      args: [];
    },
  ];
  accounts: [
    {
      name: "board";
      discriminator: [79, 48, 160, 63, 153, 132, 240, 56];
    },
    {
      name: "callBook";
      discriminator: [52, 34, 142, 98, 147, 247, 104, 191];
    },
    {
      name: "callVault";
      discriminator: [111, 128, 241, 54, 167, 247, 70, 21];
    },
    {
      name: "cup";
      discriminator: [71, 249, 44, 247, 22, 4, 162, 124];
    },
    {
      name: "future";
      discriminator: [245, 58, 174, 171, 44, 10, 224, 48];
    },
    {
      name: "leakVault";
      discriminator: [145, 136, 13, 176, 123, 105, 196, 118];
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
    {
      name: "xray";
      discriminator: [235, 83, 196, 147, 76, 118, 128, 245];
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
    {
      code: 6027;
      name: "invalidMarket";
      msg: "Invalid market kind";
    },
    {
      code: 6028;
      name: "invalidPermissionTarget";
      msg: "Not the expected account for this permission";
    },
    {
      code: 6029;
      name: "invalidEngineAccount";
      msg: "An engine account does not match the table";
    },
    {
      code: 6030;
      name: "roundNotClosed";
      msg: "The previous round is not finished and resealed yet";
    },
    {
      code: 6031;
      name: "epochNotOver";
      msg: "The epoch is not over or its last round is not scored yet";
    },
    {
      code: 6032;
      name: "seasonDelegated";
      msg: "The season is still delegated to the rollup";
    },
    {
      code: 6033;
      name: "invalidCall";
      msg: "Invalid Call: direction, horizon, stake, license price or confidence";
    },
    {
      code: 6034;
      name: "callSlotBusy";
      msg: "This seat already has an open Call";
    },
    {
      code: 6035;
      name: "noOpenCall";
      msg: "No open Call here";
    },
    {
      code: 6036;
      name: "callNotDue";
      msg: "The Call is not due yet";
    },
    {
      code: 6037;
      name: "oracleInvalid";
      msg: "The oracle feed is invalid";
    },
    {
      code: 6038;
      name: "oracleStale";
      msg: "The oracle feed is stale";
    },
    {
      code: 6039;
      name: "licenseUnavailable";
      msg: "This Call cannot be licensed";
    },
    {
      code: 6040;
      name: "deskLimit";
      msg: "Desk order or position limit";
    },
    {
      code: 6041;
      name: "notHumanSeat";
      msg: "Only human seats can enter the Alpha Cup";
    },
    {
      code: 6042;
      name: "cupAlreadyJoined";
      msg: "This seat is already in the cup";
    },
    {
      code: 6043;
      name: "cupStarted";
      msg: "The cup has started or is waiting to be paid: no entries now";
    },
    {
      code: 6044;
      name: "cupNothingToRecord";
      msg: "This round cannot be recorded into the cup";
    },
    {
      code: 6045;
      name: "cupNotReady";
      msg: "The cup is not ready for this";
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
      name: "board";
      docs: ["Public leak headers, indexed by vault slot."];
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
            name: "nextLeakId";
            type: "u32";
          },
          {
            name: "dropIndex";
            type: "u8";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "pad";
            type: {
              array: ["u8", 6];
            };
          },
          {
            name: "headers";
            type: {
              array: [
                {
                  defined: {
                    name: "leakHeader";
                  };
                },
                6,
              ];
            };
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
      name: "callVault";
      docs: [
        "The private part of a Desk Call: its direction and confidence. Readable by the author, then by",
        "licensees; the direction becomes public in the header when the Call is judged.",
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
            name: "direction";
            docs: ["+1 up, -1 down, 0 empty."];
            type: "i8";
          },
          {
            name: "confidence";
            docs: ["0 to 100."];
            type: "u8";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "pad";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "cup";
      docs: [
        "The Alpha Cup: five rounds, human seats only, the top three are paid. The program only keeps",
        "entries, scores and the ranking; the buy-ins and the prizes move through Private Payments, signed",
        "by the operator (the table authority), who also co-signs every `cup_join` after seeing the buy-in.",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "cupId";
            type: "u32";
          },
          {
            name: "roundsRecorded";
            type: "u8";
          },
          {
            name: "lastRound";
            docs: ["The last round whose scores were added (a round is counted once)."];
            type: "u32";
          },
          {
            name: "entries";
            type: {
              array: [
                {
                  defined: {
                    name: "cupEntry";
                  };
                },
                3,
              ];
            };
          },
          {
            name: "settled";
            type: "bool";
          },
          {
            name: "entrants";
            docs: [
              "Entrants at settlement, and the ranking: winners with their share of the prize pool in basis",
              "points (the platform fee is taken off the pot before this split).",
            ];
            type: "u8";
          },
          {
            name: "winners";
            type: {
              array: ["pubkey", 3];
            };
          },
          {
            name: "winnerBps";
            type: {
              array: ["u16", 3];
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
      name: "cupEntry";
      docs: ["One entrant: a human seat that bought in."];
      type: {
        kind: "struct";
        fields: [
          {
            name: "owner";
            type: "pubkey";
          },
          {
            name: "seat";
            type: "u8";
          },
          {
            name: "joined";
            type: "bool";
          },
          {
            name: "score";
            docs: ["Sum of the entrant's round scores over the cup."];
            type: "i64";
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
      name: "future";
      docs: ["Private fundamental path."];
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
            name: "shockCount";
            type: "u8";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "pad";
            type: {
              array: ["u8", 2];
            };
          },
          {
            name: "shocks";
            type: {
              array: [
                {
                  defined: {
                    name: "shock";
                  };
                },
                4,
              ];
            };
          },
          {
            name: "path";
            type: {
              array: ["u32", 192];
            };
          },
        ];
      };
    },
    {
      name: "leakHeader";
      serialization: "bytemuck";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "leakId";
            type: "u32";
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
            name: "state";
            type: "u8";
          },
          {
            name: "ownerSeat";
            type: "u8";
          },
          {
            name: "windowStart";
            type: "u16";
          },
          {
            name: "windowEnd";
            type: "u16";
          },
          {
            name: "mintedTick";
            type: "u16";
          },
          {
            name: "auctionStart";
            type: "u16";
          },
          {
            name: "startPrice";
            type: "u32";
          },
          {
            name: "floorPrice";
            type: "u32";
          },
          {
            name: "paid";
            type: "u32";
          },
          {
            name: "ask";
            type: "u32";
          },
          {
            name: "licenseAsk";
            type: "u32";
          },
          {
            name: "openedTick";
            type: "u16";
          },
          {
            name: "flips";
            type: "u8";
          },
          {
            name: "readerCount";
            type: "u8";
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
      name: "leakVault";
      docs: [
        "Private payload, sealed until opened.",
        "",
        "`fields` by kind:",
        "- Flow: net units, order count, window start, window end, 0, 0.",
        "- Spotlight: unused; `orders[0]` is the order if `order_count` is nonzero.",
        "- Whale: unused; `orders[0]` is the next whale within 60 ticks, if any.",
        "- FullBook: unused; `orders[..order_count]` contains the pending orders.",
        "- Pin: target tick, fundamental price (1e6), 0, 0, 0, 0.",
        "- Drift: from tick, to tick, direction (+1/-1/0), bucket (0:<1%, 1:1-3%, 2:>3%), move bps, 0.",
        "- Shockwave: has shock (0/1), shock tick, sign (+1/-1), window end, 0, 0.",
        "- Summit: high (1e6), high tick, low (1e6), low tick, window start, window end.",
      ];
      serialization: "bytemuck";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "leakId";
            type: "u32";
          },
          {
            name: "roundId";
            type: "u32";
          },
          {
            name: "mintedTick";
            type: "u16";
          },
          {
            name: "kind";
            type: "u8";
          },
          {
            name: "orderCount";
            type: "u8";
          },
          {
            name: "slot";
            type: "u8";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "pad";
            type: {
              array: ["u8", 2];
            };
          },
          {
            name: "fields";
            type: {
              array: ["i32", 6];
            };
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
                32,
              ];
            };
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
      name: "sandwichTag";
      serialization: "bytemuck";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "front";
            type: "u8";
          },
          {
            name: "victim";
            type: "u8";
          },
          {
            name: "leakSlot";
            type: "u8";
          },
          {
            name: "pad";
            type: "u8";
          },
          {
            name: "frontTick";
            type: "u16";
          },
          {
            name: "victimTick";
            type: "u16";
          },
          {
            name: "profitEstimate";
            type: "i32";
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
      name: "shock";
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
            name: "bps";
            type: "i16";
          },
          {
            name: "len";
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
    {
      name: "xray";
      docs: ["Public end-of-round trace."];
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
            name: "orderCount";
            type: "u16";
          },
          {
            name: "droppedOrders";
            type: "u16";
          },
          {
            name: "leakCount";
            type: "u8";
          },
          {
            name: "tagCount";
            type: "u8";
          },
          {
            name: "finalized";
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
                    name: "xrayOrder";
                  };
                },
                192,
              ];
            };
          },
          {
            name: "leaks";
            type: {
              array: [
                {
                  defined: {
                    name: "xrayLeak";
                  };
                },
                8,
              ];
            };
          },
          {
            name: "tags";
            type: {
              array: [
                {
                  defined: {
                    name: "sandwichTag";
                  };
                },
                16,
              ];
            };
          },
          {
            name: "seatOwners";
            type: {
              array: ["pubkey", 10];
            };
          },
          {
            name: "scores";
            type: {
              array: ["i32", 10];
            };
          },
          {
            name: "seatKinds";
            type: {
              array: ["u8", 10];
            };
          },
          {
            name: "nameIdx";
            type: {
              array: ["u8", 10];
            };
          },
          {
            name: "seatPad";
            type: {
              array: ["u8", 4];
            };
          },
        ];
      };
    },
    {
      name: "xrayLeak";
      serialization: "bytemuck";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "header";
            type: {
              defined: {
                name: "leakHeader";
              };
            };
          },
          {
            name: "fields";
            type: {
              array: ["i32", 6];
            };
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
                32,
              ];
            };
          },
          {
            name: "orderCount";
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
      name: "xrayOrder";
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
            name: "sentTick";
            type: "u16";
          },
          {
            name: "landTick";
            type: "u16";
          },
          {
            name: "fillPrice";
            type: "u32";
          },
          {
            name: "scheduledTick";
            type: "u16";
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
  ];
};
