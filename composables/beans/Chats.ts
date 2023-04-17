import {
  AIChatMessage,
  BaseChatMessage,
  ChainValues,
  ChatGeneration,
  HumanChatMessage,
  LLMResult,
  SystemChatMessage,
} from 'langchain/schema';
import { ChatCompletionRequestMessage } from 'openai';
import { objectToOpenaiChatMessage, openaiChatMessageToObject } from '~/utils/serde';

function langchainChatCompletionMessageToOpenai(message: BaseChatMessage): ChatCompletionRequestMessage {
  return {
    role: message instanceof HumanChatMessage ? 'user' : message instanceof AIChatMessage ? 'assistant' : 'system',
    content: message.text,
    name: message._getType(),
  };
}

export class UiChatMessage {
  constructor(
    public message: BaseChatMessage,
    public username: string,
    public error: string | undefined = undefined,
    public meta: Record<string, any> = {},
  ) {}

  static load(serialized: string) {
    const data = JSON.parse(serialized);
    return new UiChatMessage(objectToOpenaiChatMessage(data.message), data.username, data.error, data.meta || {});
  }

  dump() {
    const data = {
      message: openaiChatMessageToObject(this.message),
      username: this.username,
      error: this.error,
      meta: this.meta,
    };
    return JSON.stringify(data);
  }
}

export class UiChatDialogue {
  answering: UiChatMessage | undefined = undefined;

  constructor(
    public question: UiChatMessage,
    public answers: UiChatMessage[] = [],
    public chosen: number = -1,
    public error: any | undefined = undefined,
  ) {
    this.chosen = Math.min(this.chosen, answers.length - 1);
    if (this.chosen == -1) {
      this.chosen = answers.length;
      this.answering = answers[this.chosen] = new UiChatMessage(new AIChatMessage(''), 'GhatGPT');
    }
  }

  get inAnswering() {
    return this.answering != null;
  }

  get chosenAnswer() {
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
    const answers = data.answers.map(UiChatMessage.load);
    return new UiChatDialogue(question, answers, data.chosen, data.error);
  }

  dump() {
    return JSON.stringify({
      question: this.question.dump(),
      answers: this.answers.map((answer) => answer.dump()),
      chosen: this.chosen,
      error: this.error,
    });
  }

  async answer(llmResult: LLMResult) {
    this.answering = undefined;
    this.answers = await Promise.all(
      (llmResult.generations[0] as ChatGeneration[])
        .flatMap((choice) => (choice.message ? [choice.message] : []))
        .map(async (message) => {
          return new UiChatMessage(message, 'ChatGPT');
        }),
    );
  }

  async answerChainValues(result: ChainValues) {
    this.answering = undefined;
    this.chosenAnswer.message.text = result.text;
  }

  async failedToAnswer(error: string) {
    this.answering = undefined;
    this.chosenAnswer.error = error;
  }
}

export class UiChatConversation {
  prompt: SystemChatMessage;
  dialogues: UiChatDialogue[];

  constructor(prompt: SystemChatMessage, dialogues: UiChatDialogue[] = []) {
    this.prompt = prompt;
    this.dialogues = dialogues;
  }

  extractHistoryInLangchainChatCompletion() {
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

  extractHistoryInOpenAIChatCompletion(): ChatCompletionRequestMessage[] {
    return this.extractHistoryInLangchainChatCompletion().map(langchainChatCompletionMessageToOpenai);
  }

  extractHistoryAsQAPairs(): [string, string][] {
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
