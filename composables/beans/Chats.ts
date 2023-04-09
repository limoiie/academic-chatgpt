import {
  AIChatMessage,
  BaseChatMessage,
  ChainValues,
  ChatGeneration,
  HumanChatMessage,
  LLMResult,
  SystemChatMessage,
} from 'langchain/schema';
import { stringify } from 'yaml';
import { objectToOpenaiChatMessage, openaiChatMessageToObject } from '~/utils/serde';

export class UiChatMessage {
  constructor(public message: BaseChatMessage, public username: string) {}

  static load(serialized: string) {
    const data = JSON.parse(serialized);
    return new UiChatMessage(objectToOpenaiChatMessage(data.message), data.username);
  }

  dump() {
    const data = {
      message: openaiChatMessageToObject(this.message),
      username: this.username,
    };
    return JSON.stringify(data);
  }
}

export class UiChatDialogue {
  answering: UiChatMessage;

  constructor(
    public question: UiChatMessage,
    answering: UiChatMessage | undefined = undefined,
    public answers: UiChatMessage[] = [],
    public chosen: number = -1,
    public error: any | undefined = undefined,
  ) {
    this.answering = answering || new UiChatMessage(new AIChatMessage(''), 'GhatGPT');
  }

  get isAnswering() {
    return this.chosen == -1;
  }

  get chosenAnswer() {
    if (this.chosen == -1) {
      return this.answering;
    }
    return this.answers[this.chosen];
  }

  static loadArray(serialized: string) {
    const data = JSON.parse(serialized);
    if (data instanceof Array) {
      return data.map(UiChatDialogue.load);
    }
    return [];
  }

  static dumpArray(arr: UiChatDialogue[]) {
    return JSON.stringify(arr.map((dialogue) => dialogue.dump()));
  }

  static load(serialized: string) {
    const data = JSON.parse(serialized);
    const question = UiChatMessage.load(data.question);
    const answering = UiChatMessage.load(data.answering);
    const answers = data.answers.map(UiChatMessage.load);
    return new UiChatDialogue(question, answering, answers, data.chosen, data.error);
  }

  dump() {
    return JSON.stringify({
      question: this.question.dump(),
      answering: this.answering.dump(),
      answers: this.answers.map((answer) => answer.dump()),
      chosen: this.chosen,
      error: this.error,
    });
  }

  async answer(llmResult: LLMResult) {
    this.chosen = 0;
    this.answers = await Promise.all(
      (llmResult.generations[0] as ChatGeneration[])
        .flatMap((choice) => (choice.message ? [choice.message] : []))
        .map(async (message) => {
          return new UiChatMessage(message, 'ChatGPT');
        }),
    );
  }

  async answerChainValues(result: ChainValues) {
    this.chosen = 0;
    this.answers = [new UiChatMessage(new AIChatMessage(stringify(result)), 'ChatGPT')];
  }

  async failedToAnswer(error: unknown) {
    this.error = error;
  }
}

export class UiChatConversation {
  prompt: SystemChatMessage;
  dialogues: UiChatDialogue[];

  constructor(prompt: SystemChatMessage, dialogues: UiChatDialogue[] = []) {
    this.prompt = prompt;
    this.dialogues = dialogues;
  }

  extractMessages() {
    return [
      this.prompt,
      ...this.dialogues.flatMap((dialogue) => {
        if (!dialogue.answers || !dialogue.answers[dialogue.chosen]) {
          return [dialogue.question.message];
        }
        return [dialogue.question.message, dialogue.answers[dialogue.chosen].message];
      }),
    ];
  }

  extractHistory(): [string, string][] {
    return this.dialogues.slice(0, -1).map((dialogue) => {
      return [dialogue.question.message.text, dialogue.chosenAnswer.message.text];
    });
  }

  async question(text: string) {
    const question = new HumanChatMessage(text);
    const i = this.dialogues.push(new UiChatDialogue(new UiChatMessage(question, 'LM')));
    return this.dialogues[i - 1];
  }
}
