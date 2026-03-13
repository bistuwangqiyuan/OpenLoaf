/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { Cloud, HardDrive } from "lucide-react";
import { StepUpChoiceStep } from "@/components/step-up/StepUpChoiceStep";

export type StepUpBackupChoice = "local" | "cloud";

type StepUpBackupStepProps = {
  /** Current selection. */
  value: StepUpBackupChoice | null;
  /** Selection change handler. */
  onSelect: (next: StepUpBackupChoice) => void;
};

/** Render the backup selection step. */
export function StepUpBackupStep({ value, onSelect }: StepUpBackupStepProps) {
  return (
    <StepUpChoiceStep
      title="你的数据需要云端备份吗？"
      subtitle="我们会根据你的选择安排后续配置，你可以随时调整。"
      value={value}
      onSelect={(next) => onSelect(next as StepUpBackupChoice)}
      options={[
        {
          id: "cloud",
          title: "云端备份",
          description: "自动同步到云端，适合多设备协作。",
          badge: "推荐",
          icon: <Cloud className="size-6" />,
        },
        {
          id: "local",
          title: "本地备份",
          description: "数据保存在本机，适合离线与单设备使用。",
          icon: <HardDrive className="size-6" />,
        },
      ]}
    />
  );
}
