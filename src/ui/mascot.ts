import pc from "picocolors";

const thinkingFrames = [
  "[=   =] processing",
  "[==  =] processing",
  "[=== =] processing",
  "[==== ] processing",
];

export class ThinkingMascot {
  private timer?: ReturnType<typeof setInterval>;
  private frameIndex = 0;
  private active = false;

  constructor(
    private message = "Aegis IA is thinking",
    private detail = "",
  ) {}

  start(): void {
    if (!this.canAnimate()) return;
    this.active = true;
    this.render();
    this.timer = setInterval(() => this.render(), 180);
  }

  stop(): void {
    if (!this.active) return;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.active = false;
    process.stdout.write("\r\x1b[2K");
  }

  private render(): void {
    const frame = thinkingFrames[this.frameIndex % thinkingFrames.length];
    const dots = ".".repeat(this.frameIndex % 4).padEnd(3, " ");
    const detail = this.detail ? ` ${pc.dim(this.detail)}` : "";
    process.stdout.write(
      `\r\x1b[2K\x1b[38;2;248;120;8m${frame}\x1b[39m  ${pc.bold(this.message)}${dots}${detail}`,
    );
    this.frameIndex += 1;
  }

  private canAnimate(): boolean {
    return Boolean(
      process.stdout.isTTY &&
        process.env.AEGIS_NO_ANIMATIONS !== "1" &&
        process.env.CI !== "1",
    );
  }
}

export function assistantLabel(): string {
  return `\x1b[38;2;67;199;255mAegis IA\x1b[39m ${pc.bold(">")}` + " ";
}
