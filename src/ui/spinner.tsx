import React from "react";
import { Text } from "ink";
import chalk from "chalk";

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface SpinnerProps {
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ label = "Thinking..." }) => {
  const [frame, setFrame] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text>
      {chalk.hex("#8B8B8B")(frames[frame])} {chalk.hex("#707070")(label)}
    </Text>
  );
};
