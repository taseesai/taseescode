#!/usr/bin/env node

import React, { useState } from "react";
import { render } from "ink";
import { Command } from "commander";
import { App } from "./app";
import { getConfig } from "./utils/config";
import { Onboarding } from "./ui/onboarding";

const Root: React.FC = () => {
  const [showApp, setShowApp] = useState(() => {
    const config = getConfig();
    return config.hasCompletedOnboarding === true;
  });

  if (!showApp) {
    return React.createElement(Onboarding, {
      onComplete: () => setShowApp(true),
    });
  }

  return React.createElement(App);
};

const program = new Command();

program
  .name("taseescode")
  .description("Arabic-first AI coding assistant by TaseesAI")
  .version("1.0.0")
  .option("-m, --model <model>", "Model to use (deepseek-v3, claude-sonnet, gpt-4o)")
  .action(() => {
    render(React.createElement(Root));
  });

program.parse(process.argv);
