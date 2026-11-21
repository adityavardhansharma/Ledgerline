import { Landing } from "@/components/landing/Landing";
import { MotionProvider } from "@/components/MotionProvider";
import "./landing.css";

export const metadata = {
  title: { absolute: "Ledgerline · Management accounts and forecasts from Xero" },
  description: "Your profit and loss, balance sheet, cash flow and runway, every morning, checked against Xero to the cent.",
};

export default function Home() {
  return (
    <MotionProvider layout>
      <Landing />
    </MotionProvider>
  );
}
