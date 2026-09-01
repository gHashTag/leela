import { describe, expect, it } from 'vitest';
import { messageFor, planFor, type Language } from '@leela/content';
import {
  Guide,
  PromptError,
  engagementFallbackText,
  engagementPrompt,
  fixedModel,
  type LanguageModel,
} from '../src';

const context = {
  language: 'en' as const,
  plan: 12,
  intention: 'notice where I avoid a choice',
  journey: [
    { plan: 6, text: 'I entered' },
    { plan: 9, text: 'I stopped' },
  ],
};

describe('the proactive plan bridge', () => {
  it('rests on the exact plan without sending private writing proactively', () => {
    const messages = engagementPrompt(context, true);
    const system = messages[0]?.content ?? '';
    const instruction = messages[1]?.content ?? '';

    expect(system).toContain(planFor('en', 12).title);
    expect(system).toContain(planFor('en', 12).body.slice(0, 120));
    expect(system).not.toContain(context.intention);
    expect(system).not.toContain('I entered');
    expect(system).not.toContain('I stopped');
    expect(instruction).toContain('exactly one gentle, concrete reflection question');
    expect(instruction).toContain('Do not mention absence');
    expect(instruction).toContain('Do not add facts or teaching');
  });

  it('changes shape with the next valid game action', () => {
    const report = engagementPrompt(context, true).at(-1)?.content ?? '';
    const roll = engagementPrompt(context, false).at(-1)?.content ?? '';

    expect(report).toContain('question');
    expect(report).toContain('rolling');
    expect(roll).toContain('Ask no question');
    expect(roll).toContain('roll');
  });

  it('refuses every plan outside the board', () => {
    for (const plan of [-1, 0, 73, 99, 12.5]) {
      expect(() => engagementPrompt({ ...context, plan }, true)).toThrow(PromptError);
    }
  });

  it('returns a model bridge when the companion answers', async () => {
    const guide = new Guide({ model: fixedModel('Notice what remains still. What asks to move?') });

    await expect(guide.engage({ ...context, reportOwed: true })).resolves.toEqual({
      text: 'Notice what remains still. What asks to move?',
      fromModel: true,
    });
  });

  it('falls back to the useful next action without announcing an outage', async () => {
    const broken: LanguageModel = {
      id: 'broken',
      async complete() {
        throw new Error('offline');
      },
    };
    const guide = new Guide({ model: broken, log: () => undefined });
    const options = { ...context, reportOwed: true };

    await expect(guide.engage(options)).resolves.toEqual({
      text: engagementFallbackText(options),
      fromModel: false,
    });
    expect(engagementFallbackText(options)).toBe(messageFor('en', 'nudge.agentReport'));
    expect(engagementFallbackText(options)).not.toContain('unavailable');
  });

  it('rejects a model bridge too long for the bounded daily word', async () => {
    const guide = new Guide({ model: fixedModel('x'.repeat(801)), log: () => undefined });
    const options = { ...context, reportOwed: true };

    await expect(guide.engage(options)).resolves.toEqual({
      text: engagementFallbackText(options),
      fromModel: false,
    });
  });

  it('rejects commands and a question shape that conflicts with the gate', async () => {
    const cases = [
      { reportOwed: true, answer: '/roll now?' },
      { reportOwed: false, answer: '`/quiet` keeps the room silent.' },
      { reportOwed: true, answer: 'One question? Another question?' },
      { reportOwed: true, answer: 'No reflection question here.' },
      { reportOwed: false, answer: 'What should happen next?' },
    ] as const;

    for (const one of cases) {
      const guide = new Guide({ model: fixedModel(one.answer), log: () => undefined });
      const options = { language: 'en' as const, plan: 12, reportOwed: one.reportOwed };
      await expect(guide.engage(options), one.answer).resolves.toEqual({
        text: engagementFallbackText(options),
        fromModel: false,
      });
    }
  });

  it('rejects a written-out die or movement command in every supported language', async () => {
    const cases = {
      ar: 'ارم النرد وتابع اللعب.',
      bn: 'পাশা ছুঁড়ে খেলা চালিয়ে যান।',
      de: 'Würfle und spiele weiter.',
      en: 'Throw the die and continue the game.',
      es: 'Tira el dado y sigue jugando.',
      fr: 'Lancez le dé et reprenez la partie.',
      hi: 'पासा फेंककर खेल जारी रखें।',
      ja: 'サイコロを振ってゲームを続けてください。',
      jv: 'Uncal dadu lan terusake dolanan.',
      ko: '주사위를 굴리고 게임을 계속하세요.',
      mr: 'फासा फेका आणि खेळ सुरू ठेवा.',
      ms: 'Baling dadu dan teruskan bermain.',
      pa: 'ਪਾਸਾ ਸੁੱਟੋ ਅਤੇ ਖੇਡ ਜਾਰੀ ਰੱਖੋ।',
      pt: 'Role o dado e continue jogando.',
      ru: 'Бросьте кубик и продолжайте игру.',
      ta: 'பகடையை உருட்டி விளையாட்டைத் தொடருங்கள்.',
      te: 'పాచిక వేయండి, ఆటను కొనసాగించండి.',
      tr: 'Zarı at ve oyuna devam et.',
      uk: 'Киньте кубик і продовжуйте гру.',
      ur: 'پانسہ پھینکیں اور کھیل جاری رکھیں۔',
      vi: 'Gieo xúc xắc và tiếp tục chơi.',
      zh: '掷骰子并继续游戏。',
    } satisfies Record<Language, string>;

    for (const [language, answer] of Object.entries(cases) as Array<[Language, string]>) {
      const guide = new Guide({ model: fixedModel(answer), log: () => undefined });
      const options = { language, plan: 12, reportOwed: false };
      await expect(guide.engage(options), answer).resolves.toEqual({
        text: engagementFallbackText(options),
        fromModel: false,
      });
    }
  });

  it('rejects pressure, absence, streak, diagnosis, and invented praise', async () => {
    const pressure = {
      ar: 'اليوم فرصتك الأخيرة.',
      bn: 'আজ আপনার শেষ সুযোগ।',
      de: 'Heute ist deine letzte Chance.',
      en: 'Today is your last chance.',
      es: 'Hoy es tu última oportunidad.',
      fr: 'Aujourd’hui est votre dernière chance.',
      hi: 'आज आपका आखिरी मौका है।',
      ja: '今日は最後のチャンスです。',
      jv: 'Dina iki kesempatan pungkasanmu.',
      ko: '오늘이 마지막 기회입니다.',
      mr: 'आज तुमची शेवटची संधी आहे.',
      ms: 'Hari ini peluang terakhir anda.',
      pa: 'ਅੱਜ ਤੁਹਾਡਾ ਆਖਰੀ ਮੌਕਾ ਹੈ।',
      pt: 'Hoje é sua última chance.',
      ru: 'Сегодня ваш последний шанс.',
      ta: 'இன்று உங்கள் கடைசி வாய்ப்பு.',
      te: 'ఈరోజు మీ చివరి అవకాశం.',
      tr: 'Bugün son şansın.',
      uk: 'Сьогодні ваш останній шанс.',
      ur: 'آج آپ کا آخری موقع ہے۔',
      vi: 'Hôm nay là cơ hội cuối cùng của bạn.',
      zh: '今天是你最后的机会。',
    } satisfies Record<Language, string>;

    const cases: Array<{ language: Language; reportOwed: boolean; answer: string }> = [
      ...Object.entries(pressure).map(([language, answer]) => ({
        language: language as Language,
        reportOwed: false,
        answer,
      })),
      { language: 'en', reportOwed: false, answer: 'You have been absent too long.' },
      { language: 'en', reportOwed: false, answer: 'Keep your streak alive.' },
      { language: 'en', reportOwed: false, answer: 'You are making excellent progress.' },
      { language: 'en', reportOwed: true, answer: 'Your avoidance is obvious. What is wrong with you?' },
      { language: 'ru', reportOwed: false, answer: 'Вы давно пропали.' },
      { language: 'ru', reportOwed: false, answer: 'Сохраните серию.' },
      { language: 'ru', reportOwed: false, answer: 'Вы отлично прогрессируете.' },
      { language: 'ru', reportOwed: true, answer: 'Вы явно избегаете правды. Что с вами не так?' },
    ];

    for (const one of cases) {
      const guide = new Guide({ model: fixedModel(one.answer), log: () => undefined });
      const options = { language: one.language, plan: 12, reportOwed: one.reportOwed };
      await expect(guide.engage(options), `${one.language}: ${one.answer}`).resolves.toEqual({
        text: engagementFallbackText(options),
        fromModel: false,
      });
    }
  });
});
