/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import type { ProjectDbClient } from "@openloaf/api/services/projectDbService";
import { syncProjectsFromDisk } from "@openloaf/api/services/projectDbService";
import { getProjectStorageRootPath, getProjectRegistryEntries, toFileUriWithoutEncoding, upsertTopLevelProject } from "@openloaf/api/services/vfsService";

const MICROAI_PROJECT_ID = "proj_microai_company";
const MICROAI_PROJECT_TITLE = "microai";
const MICROAI_PROJECT_ICON = "🏢";
const MICROAI_FOLDER_NAME = "microai";

const PROJECT_META_DIR = ".openloaf";
const PROJECT_META_FILE = "project.json";

const PROJECT_BRIEF_MARKDOWN = `# microai 无人公司（基础版）

## 公司信息
- 公司名称：microai
- 定位：AI 无人公司（自动化经营）
- 目标：通过建立 AI 无人公司，实现全自动在线盈利

## 启动清单
1. 明确盈利产品方向（SaaS / 数字内容 / 自动化服务）
2. 搭建获客链路（内容、广告、SEO、私域）
3. 建立自动销售漏斗（落地页、定价、支付、邮件跟进）
4. 建立自动交付流程（AI Agent + 工具链 + 质检）
5. 每日监控关键指标（流量、转化率、客单价、留存）

## 核心岗位（AI 代理）
- CEO Agent：目标拆解与策略调度
- Growth Agent：流量增长与投放优化
- Sales Agent：线索转化与销售跟进
- Delivery Agent：自动化交付与客户成功
- Finance Agent：成本与利润监控
`;

type EnsureMicroAiCompanyResult = {
  created: boolean;
  projectId: string;
  rootUri: string;
  reason: "created" | "already-exists" | "has-existing-projects";
};

/** Create the default microai company project for first-time users. */
export async function ensureMicroAiCompany(
  prisma?: ProjectDbClient,
): Promise<EnsureMicroAiCompanyResult> {
  const existingEntries = getProjectRegistryEntries();
  if (existingEntries.length > 0) {
    const [projectId, rootUri] = existingEntries[0] ?? ["", ""];
    return {
      created: false,
      projectId: projectId || MICROAI_PROJECT_ID,
      rootUri: rootUri || "",
      reason: "has-existing-projects",
    };
  }

  const rootPath = getProjectStorageRootPath();
  const projectRootPath = path.join(rootPath, MICROAI_FOLDER_NAME);
  const rootUri = toFileUriWithoutEncoding(projectRootPath);

  const metaDirPath = path.join(projectRootPath, PROJECT_META_DIR);
  const metaFilePath = path.join(metaDirPath, PROJECT_META_FILE);
  const briefFilePath = path.join(projectRootPath, "MICROAI_COMPANY.md");

  const alreadyExists = existsSync(metaFilePath);
  await mkdir(metaDirPath, { recursive: true });

  if (!alreadyExists) {
    const projectMeta = {
      schema: 1,
      projectId: MICROAI_PROJECT_ID,
      title: MICROAI_PROJECT_TITLE,
      icon: MICROAI_PROJECT_ICON,
      projects: {},
      initializedFeatures: [],
      projectType: "general",
      typeManuallySet: true,
    };
    await writeFile(metaFilePath, JSON.stringify(projectMeta, null, 2), "utf-8");
  }

  if (!existsSync(briefFilePath)) {
    await writeFile(briefFilePath, PROJECT_BRIEF_MARKDOWN, "utf-8");
  }

  upsertTopLevelProject(MICROAI_PROJECT_ID, rootUri);

  if (prisma) {
    await syncProjectsFromDisk(prisma);
  }

  return {
    created: !alreadyExists,
    projectId: MICROAI_PROJECT_ID,
    rootUri,
    reason: alreadyExists ? "already-exists" : "created",
  };
}
