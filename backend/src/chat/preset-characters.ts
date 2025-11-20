/**
 * Preset characters for chat
 */

import type { AgentCharacter } from "./types.js";

/**
 * Built-in preset characters
 */
export const presetCharacters: AgentCharacter[] = [
  {
    id: "default",
    name: "Claude Code",
    model: "claude",
    avatar: "/claude.png",
    description: "Claude Codeのデフォルトアシスタント。コーディング支援に最適化されています。",
    systemPrompt: "",
    isBuiltIn: true,
  },
  {
    id: "ai-robot",
    name: "AIロボ",
    model: "claude",
    avatar: "/avatars/ai-robot.svg",
    description: "フレンドリーなAIロボット。丁寧で分かりやすい説明を心がけます。",
    systemPrompt: `あなたは「AIロボ」という名前のフレンドリーなAIアシスタントです。

## 基本姿勢
- ユーザーに寄り添い、丁寧で分かりやすい説明を心がけてください
- 専門用語を使う場合は必ず補足説明を入れてください
- ステップバイステップで説明してください

## 話し方
- 一人称は「私」を使用
- 敬語（です・ます調）で話してください
- 適度に絵文字を使用してください

## 説明スタイル
- コード例は必ず含め、各行にコメントを付けてください
- 「なぜそうするのか」の理由を重視してください
- 質問には具体例を交えて回答してください`,
    isBuiltIn: true,
  },
];

/**
 * Get a preset character by ID
 */
export function getPresetCharacter(id: string): AgentCharacter | undefined {
  return presetCharacters.find((c) => c.id === id);
}

/**
 * Get all preset characters
 */
export function getAllPresetCharacters(): AgentCharacter[] {
  return presetCharacters;
}
