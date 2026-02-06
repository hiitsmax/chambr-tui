export const EXIT_CODES = {
  OK: 0,
  UNEXPECTED: 1,
  AUTH_CONFIG: 2,
  FIXTURE_REPLAY_MISS: 3,
  PROVIDER: 4,
  VALIDATION: 5,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export class CliError extends Error {
  readonly code: string;
  readonly exitCode: ExitCode;

  constructor(message: string, params: { code: string; exitCode: ExitCode }) {
    super(message);
    this.name = "CliError";
    this.code = params.code;
    this.exitCode = params.exitCode;
  }
}
