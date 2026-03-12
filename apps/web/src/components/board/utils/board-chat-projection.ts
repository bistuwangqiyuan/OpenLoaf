/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import type { CanvasElement, CanvasNodeElement } from "../engine/types";
import type { TextNodeProps } from "../nodes/TextNode";
import type { ImageGenerateNodeProps } from "../nodes/imageGenerate/types";
import type { VideoGenerateNodeProps } from "../nodes/videoGenerate/types";
import type { FileAttachmentNodeProps } from "../nodes/FileAttachmentNode";
import type { VideoNodeProps } from "../nodes/VideoNode";
import { IMAGE_GENERATE_NODE_TYPE, VIDEO_GENERATE_NODE_TYPE } from "../nodes/node-config";
import { buildImageNodePayloadFromUri } from "./image";
import { resolveFileName } from "@/lib/image/uri";
import { parseScopedProjectPath } from "@/components/project/filesystem/utils/file-system-utils";
import { normalizeToolInput } from "@/components/ai/message/tools/shared/tool-utils";
import {
  getBoardChatMessageChildIds,
  layoutBoardChatMessageGroup,
  updateBoardChatPartMeta,
} from "./board-chat-message";

type ProjectableNodeType =
  | "text"
  | "image"
  | "video"
  | "file-attachment"
  | typeof IMAGE_GENERATE_NODE_TYPE
  | typeof VIDEO_GENERATE_NODE_TYPE;

type BoardChatProjectionPart =
  | {
      key: string;
      projectionKind: "text";
      nodeType: "text";
      props: Partial<TextNodeProps>;
      size: [number, number];
    }
  | {
      key: string;
      projectionKind: "image";
      nodeType: "image";
      props: Record<string, unknown>;
      size: [number, number];
    }
  | {
      key: string;
      projectionKind: "video";
      nodeType: "video";
      props: Partial<VideoNodeProps>;
      size: [number, number];
    }
  | {
      key: string;
      projectionKind: "file";
      nodeType: "file-attachment";
      props: Partial<FileAttachmentNodeProps>;
      size: [number, number];
    }
  | {
      key: string;
      projectionKind: "image-generate";
      nodeType: typeof IMAGE_GENERATE_NODE_TYPE;
      props: Partial<ImageGenerateNodeProps>;
      size: [number, number];
    }
  | {
      key: string;
      projectionKind: "video-generate";
      nodeType: typeof VIDEO_GENERATE_NODE_TYPE;
      props: Partial<VideoGenerateNodeProps>;
      size: [number, number];
    };

type MediaGenerateSnapshot = {
  status: "generating" | "done" | "error";
  kind?: "image" | "video";
  prompt?: string;
  progress?: number;
  urls?: string[];
  errorCode?: string;
};

type MediaGenerateLikePart = {
  type: string;
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string | null;
  mediaGenerate?: MediaGenerateSnapshot;
};

type BoardChatTextPart = {
  type: "text";
  text: string;
};

type BoardChatFilePart = {
  type: "file";
  url: string;
  mediaType?: string;
};

type BoardChatLogicalPart = MediaGenerateLikePart | BoardChatTextPart | BoardChatFilePart;

type ProjectionEngine = {
  batch: (fn: () => void) => void;
  commitHistory: () => void;
  addNodeElement: <P extends Record<string, unknown>>(
    type: string,
    props: Partial<P>,
    xywh?: [number, number, number, number],
    options?: { skipMindmapLayout?: boolean; skipHistory?: boolean },
  ) => string | null;
  selection: {
    getSelectedIds: () => string[];
    setSelection: (ids: string[]) => void;
  };
  doc: {
    getElementById: (id: string) => CanvasElement | null | undefined;
    getElements: () => CanvasElement[];
    transact: (fn: () => void) => void;
    updateElement: (id: string, patch: Partial<CanvasNodeElement>) => void;
    updateNodeProps: (id: string, patch: Record<string, unknown>) => void;
    deleteElement: (id: string) => void;
    deleteElements: (ids: string[]) => void;
  };
};

const TEXT_PART_WIDTH = 400;
const TEXT_PART_MIN_HEIGHT = 72;
const FILE_NODE_SIZE: [number, number] = [320, 72];
const VIDEO_NODE_SIZE: [number, number] = [360, 220];
const IMAGE_GENERATE_NODE_SIZE: [number, number] = [320, 260];
const VIDEO_GENERATE_NODE_SIZE: [number, number] = [360, 280];

/** Merge two media-generate-like part payloads. */
function mergeMediaGeneratePart(
  previous: MediaGenerateLikePart | null,
  next: MediaGenerateLikePart,
): MediaGenerateLikePart {
  if (!previous) return next;
  const mediaGenerate = next.mediaGenerate
    ? previous.mediaGenerate
      ? {
          ...previous.mediaGenerate,
          ...next.mediaGenerate,
          status: next.mediaGenerate.status,
        }
      : next.mediaGenerate
    : previous.mediaGenerate;
  return {
    ...previous,
    ...next,
    mediaGenerate,
  };
}

/** Normalize a media generate data part into a synthetic tool part. */
function normalizeMediaGenerateDataPart(part: any): MediaGenerateLikePart | null {
  const type = typeof part?.type === "string" ? part.type : "";
  if (
    type !== "data-media-generate-start" &&
    type !== "data-media-generate-progress" &&
    type !== "data-media-generate-end" &&
    type !== "data-media-generate-error"
  ) {
    return null;
  }

  const data = part?.data as Record<string, unknown> | undefined;
  const toolCallId = typeof data?.toolCallId === "string" ? data.toolCallId : "";
  const kind = data?.kind === "video" ? "video" : "image";
  if (!toolCallId) return null;

  if (type === "data-media-generate-error") {
    return {
      type: kind === "video" ? "tool-video-generate" : "tool-image-generate",
      toolCallId,
      toolName: kind === "video" ? "video-generate" : "image-generate",
      errorText: typeof data?.errorCode === "string" ? data.errorCode : "generation_failed",
      mediaGenerate: {
        status: "error",
        kind,
        errorCode: typeof data?.errorCode === "string" ? data.errorCode : undefined,
      },
    };
  }

  if (type === "data-media-generate-end") {
    return {
      type: kind === "video" ? "tool-video-generate" : "tool-image-generate",
      toolCallId,
      toolName: kind === "video" ? "video-generate" : "image-generate",
      mediaGenerate: {
        status: "done",
        kind,
        urls: Array.isArray(data?.urls) ? (data?.urls as string[]) : [],
      },
    };
  }

  return {
    type: kind === "video" ? "tool-video-generate" : "tool-image-generate",
    toolCallId,
    toolName: kind === "video" ? "video-generate" : "image-generate",
    mediaGenerate: {
      status: "generating",
      kind,
      prompt: typeof data?.prompt === "string" ? data.prompt : undefined,
      progress: typeof data?.progress === "number" ? data.progress : undefined,
    },
  };
}

/** Return whether the part is a supported media generate tool part. */
function isMediaGenerateToolPart(part: any): part is MediaGenerateLikePart {
  const toolName =
    typeof part?.toolName === "string"
      ? part.toolName
      : typeof part?.type === "string" && part.type.startsWith("tool-")
        ? part.type.slice("tool-".length)
        : "";
  return toolName === "image-generate" || toolName === "video-generate";
}

/** Return whether the logical part is a text projection part. */
function isBoardChatTextPart(part: unknown): part is BoardChatTextPart {
  return (
    Boolean(part) &&
    typeof part === "object" &&
    (part as { type?: unknown }).type === "text" &&
    typeof (part as { text?: unknown }).text === "string"
  );
}

/** Return whether the logical part is a file projection part. */
function isBoardChatFilePart(part: unknown): part is BoardChatFilePart {
  return (
    Boolean(part) &&
    typeof part === "object" &&
    (part as { type?: unknown }).type === "file" &&
    typeof (part as { url?: unknown }).url === "string"
  );
}

/** Resolve a prompt text from a tool part input payload. */
function resolveToolPromptText(part: MediaGenerateLikePart): string {
  const inputPayload = normalizeToolInput(part.input);
  if (!inputPayload || typeof inputPayload !== "object" || Array.isArray(inputPayload)) {
    return part.mediaGenerate?.prompt ?? "";
  }
  const record = inputPayload as Record<string, unknown>;
  return typeof record.prompt === "string"
    ? record.prompt
    : part.mediaGenerate?.prompt ?? "";
}

/** Build logical projection parts from raw streamed or persisted message parts. */
export function buildBoardChatProjectionParts(rawParts: unknown[]): BoardChatLogicalPart[] {
  const merged: BoardChatLogicalPart[] = [];
  const toolIndexById = new Map<string, number>();

  rawParts.forEach((part) => {
    if (!part || typeof part !== "object") return;
    const normalizedMediaData = normalizeMediaGenerateDataPart(part as any);
    if (normalizedMediaData) {
      const key = normalizedMediaData.toolCallId ?? "";
      const existingIndex = key ? toolIndexById.get(key) : undefined;
      if (existingIndex != null) {
        const existing = merged[existingIndex] as MediaGenerateLikePart | undefined;
        merged[existingIndex] = mergeMediaGeneratePart(existing ?? null, normalizedMediaData);
      } else {
        merged.push(normalizedMediaData);
        if (key) toolIndexById.set(key, merged.length - 1);
      }
      return;
    }

    const maybeText = part as { type?: string; text?: string };
    if (maybeText.type === "text" && typeof maybeText.text === "string") {
      const last = merged.at(-1);
      if (isBoardChatTextPart(last)) {
        last.text += maybeText.text;
      } else {
        merged.push({ type: "text", text: maybeText.text });
      }
      return;
    }

    const maybeFile = part as { type?: string; url?: string; mediaType?: string };
    if (maybeFile.type === "file" && typeof maybeFile.url === "string" && maybeFile.url.trim().length > 0) {
      merged.push({
        type: "file",
        url: maybeFile.url,
        mediaType: typeof maybeFile.mediaType === "string" ? maybeFile.mediaType : undefined,
      });
      return;
    }

    if (isMediaGenerateToolPart(part)) {
      const toolPart = part as MediaGenerateLikePart;
      const key = toolPart.toolCallId ?? "";
      const existingIndex = key ? toolIndexById.get(key) : undefined;
      if (existingIndex != null) {
        const existing = merged[existingIndex] as MediaGenerateLikePart | undefined;
        merged[existingIndex] = mergeMediaGeneratePart(existing ?? null, toolPart);
      } else {
        merged.push(toolPart);
        if (key) toolIndexById.set(key, merged.length - 1);
      }
    }
  });

  return merged;
}

/** Build projected board node descriptors from logical message parts. */
async function buildProjectionDescriptors(input: {
  parts: ReturnType<typeof buildBoardChatProjectionParts>;
  projectId?: string;
}): Promise<BoardChatProjectionPart[]> {
  const nextParts: BoardChatProjectionPart[] = [];
  let textIndex = 0;
  let fileIndex = 0;

  for (const rawPart of input.parts) {
    if (isBoardChatTextPart(rawPart)) {
      const text = rawPart.text.trim();
      if (!text) continue;
      nextParts.push({
        key: `text:${textIndex}`,
        projectionKind: "text",
        nodeType: "text",
        props: {
          readOnlyProjection: true,
          markdownText: rawPart.text,
        },
        size: [TEXT_PART_WIDTH, TEXT_PART_MIN_HEIGHT],
      });
      textIndex += 1;
      continue;
    }

    if (isBoardChatFilePart(rawPart)) {
      const mediaType = rawPart.mediaType ?? "";
      const keyBase = `file:${fileIndex}`;
      if (mediaType.startsWith("image/")) {
        try {
          const payload = await buildImageNodePayloadFromUri(rawPart.url, {
            projectId: input.projectId,
          });
          nextParts.push({
            key: keyBase,
            projectionKind: "image",
            nodeType: "image",
            props: payload.props,
            size: payload.size,
          });
        } catch {
          const fileName = resolveFileName(rawPart.url, mediaType) || "Image";
          nextParts.push({
            key: keyBase,
            projectionKind: "file",
            nodeType: "file-attachment",
            props: {
              sourcePath: rawPart.url,
              fileName,
              extension: fileName.split(".").pop()?.toLowerCase(),
            },
            size: FILE_NODE_SIZE,
          });
        }
      } else if (mediaType.startsWith("video/")) {
        nextParts.push({
          key: keyBase,
          projectionKind: "video",
          nodeType: "video",
          props: {
            sourcePath: rawPart.url,
            fileName: resolveFileName(rawPart.url, mediaType),
          },
          size: VIDEO_NODE_SIZE,
        });
      } else {
        const fileName =
          resolveFileName(rawPart.url, mediaType) ||
          parseScopedProjectPath(rawPart.url)?.relativePath?.split("/").pop() ||
          "File";
        nextParts.push({
          key: keyBase,
          projectionKind: "file",
          nodeType: "file-attachment",
          props: {
            sourcePath: rawPart.url,
            fileName,
            extension: fileName.split(".").pop()?.toLowerCase(),
          },
          size: FILE_NODE_SIZE,
        });
      }
      fileIndex += 1;
      continue;
    }

    if (!isMediaGenerateToolPart(rawPart)) {
      continue;
    }

    const toolName =
      typeof rawPart.toolName === "string"
        ? rawPart.toolName
        : rawPart.type === "tool-video-generate"
          ? "video-generate"
          : "image-generate";
    const isVideo = toolName === "video-generate";
    const mediaGenerate = rawPart.mediaGenerate;
    const output = rawPart.output as Record<string, unknown> | undefined;
    const resultUrls = Array.isArray(mediaGenerate?.urls)
      ? mediaGenerate?.urls
      : Array.isArray(output?.urls)
        ? (output?.urls as string[])
        : [];
    const projectionStatus =
      mediaGenerate?.status ??
      (rawPart.errorText ? "error" : resultUrls.length > 0 ? "done" : "generating");
    const promptText = resolveToolPromptText(rawPart);
    const toolKey = rawPart.toolCallId ? `tool:${rawPart.toolCallId}` : `${toolName}:${fileIndex++}`;

    if (isVideo) {
      nextParts.push({
        key: toolKey,
        projectionKind: "video-generate",
        nodeType: VIDEO_GENERATE_NODE_TYPE,
        props: {
          readOnlyProjection: true,
          promptText,
          resultVideo: resultUrls[0],
          errorText: rawPart.errorText ?? undefined,
          projectionStatus,
        },
        size: VIDEO_GENERATE_NODE_SIZE,
      });
      continue;
    }

    nextParts.push({
      key: toolKey,
      projectionKind: "image-generate",
      nodeType: IMAGE_GENERATE_NODE_TYPE,
      props: {
        readOnlyProjection: true,
        promptText,
        resultImages: resultUrls,
        errorText: rawPart.errorText ?? undefined,
        projectionStatus,
      },
      size: IMAGE_GENERATE_NODE_SIZE,
    });
  }

  return nextParts;
}

/** Delete connectors bound to an element id. */
function deleteElementConnectors(engine: ProjectionEngine, elementId: string): void {
  const connectorIds = engine.doc
    .getElements()
    .filter((item) => item.kind === "connector")
    .filter((item) => {
      const sourceId = "elementId" in item.source ? item.source.elementId : null;
      const targetId = "elementId" in item.target ? item.target.elementId : null;
      return sourceId === elementId || targetId === elementId;
    })
    .map((item) => item.id);
  if (connectorIds.length > 0) {
    engine.doc.deleteElements(connectorIds);
  }
}

/** Project message parts into ordered board nodes inside a message group. */
export async function projectBoardChatMessageParts(input: {
  engine: ProjectionEngine;
  groupId: string;
  rawParts: unknown[];
  projectId?: string;
}): Promise<void> {
  const group = input.engine.doc.getElementById(input.groupId);
  if (!group || group.kind !== "node") return;
  const logicalParts = buildBoardChatProjectionParts(Array.isArray(input.rawParts) ? input.rawParts : []);
  const descriptors = await buildProjectionDescriptors({
    parts: logicalParts,
    projectId: input.projectId,
  });
  const elements = input.engine.doc.getElements();
  const existingChildIds = getBoardChatMessageChildIds(
    group as CanvasNodeElement<{ childIds?: string[] }>,
    elements,
  );
  const existingByKey = new Map(
    existingChildIds
      .map((id) => input.engine.doc.getElementById(id))
      .filter((item): item is CanvasNodeElement => item?.kind === "node")
      .map((node) => [getBoardChatPartKey(node), node] as const)
      .filter((entry): entry is [string, CanvasNodeElement] => Boolean(entry[0])),
  );
  const selectionSnapshot = input.engine.selection.getSelectedIds();
  const nextChildIds: string[] = [];

  input.engine.batch(() => {
    input.engine.doc.transact(() => {
      descriptors.forEach((descriptor) => {
        const existing = existingByKey.get(descriptor.key) ?? null;
        let nodeId = existing?.id ?? null;
        const expectedType = descriptor.nodeType as ProjectableNodeType;

        if (existing && existing.type !== expectedType) {
          deleteElementConnectors(input.engine, existing.id);
          input.engine.doc.deleteElement(existing.id);
          nodeId = null;
        }

        if (!nodeId) {
          nodeId = input.engine.addNodeElement(
            expectedType,
            descriptor.props as Record<string, unknown>,
            [group.xywh[0], group.xywh[1], descriptor.size[0], descriptor.size[1]],
            { skipHistory: true },
          );
        }

        if (!nodeId) return;
        nextChildIds.push(nodeId);
        input.engine.doc.updateNodeProps(nodeId, descriptor.props as Record<string, unknown>);
        const node = input.engine.doc.getElementById(nodeId);
        if (node && node.kind === "node") {
          const [, , currentWidth, currentHeight] = node.xywh;
          const nextWidth = descriptor.nodeType === "text" ? descriptor.size[0] : currentWidth;
          const nextHeight =
            descriptor.nodeType === "text" ? currentHeight : descriptor.size[1];
          input.engine.doc.updateElement(nodeId, {
            xywh: [node.xywh[0], node.xywh[1], nextWidth, nextHeight],
          });
        }
        updateBoardChatPartMeta(input.engine, nodeId, {
          messageGroupId: input.groupId,
          partKey: descriptor.key,
          projectionKind: descriptor.projectionKind,
        });
      });

      existingChildIds.forEach((childId) => {
        if (nextChildIds.includes(childId)) return;
        deleteElementConnectors(input.engine, childId);
        input.engine.doc.deleteElement(childId);
      });

      input.engine.doc.updateNodeProps(input.groupId, { childIds: nextChildIds });
    });
  });

  input.engine.selection.setSelection(selectionSnapshot);
  layoutBoardChatMessageGroup(input.engine, input.groupId);
}

/** Resolve stored board chat part key from node meta. */
function getBoardChatPartKey(element: CanvasNodeElement): string {
  const meta = element.meta as Record<string, unknown> | undefined;
  const boardMeta = meta?.boardChatPart;
  if (!boardMeta || typeof boardMeta !== "object" || Array.isArray(boardMeta)) return "";
  return typeof (boardMeta as Record<string, unknown>).partKey === "string"
    ? ((boardMeta as Record<string, unknown>).partKey as string)
    : "";
}
