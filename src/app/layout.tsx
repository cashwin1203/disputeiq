import type { Metadata } from "next";
import "@carbon/styles/css/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "DisputeIQ | Human-led dispute operations",
  description: "A synthetic payment-dispute workspace for evaluating reliable, human-led AI decisions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
