import { gameRepository } from "../repositories/gameRepository";
import { UserAnswer, GameFullState } from "../types/game";

export const gameEngine = {
  isAnswerCorrect(correctIndexes: number[], playerAnswer: number[]) {
    const correctSet = new Set(correctIndexes);
    return (
      playerAnswer.length === correctSet.size &&
      playerAnswer.every((i) => correctSet.has(i))
    );
  },

  calculateScore(
    correctIndexes: number[],
    playerAnswer: number[],
    scoringWeight: number,
  ) {
    const SCORE = 1000;
    if (this.isAnswerCorrect(correctIndexes, playerAnswer)) {
      return SCORE * scoringWeight;
    }
    return 0;
  },

  buildDistribution(answers: Record<string, UserAnswer>, answerCount: number) {
    const counts = new Array(answerCount).fill(0);

    for (const answer of Object.values(answers)) {
      for (const index of answer.indexes) {
        counts[index]++;
      }
    }

    return counts;
  },

  mapLeaderboard(leaderboard: any[], players: string[]) {
    // todo: fix
    return leaderboard;
    // .map((p) => ({
    //   nickname: players[p.value].nickname,
    //   score: p.score,
    // }));
  },

  // Build the view that all players in a game can see
  buildSharedPlayerView(gameState: GameFullState) {
    const { meta, question } = gameState;

    switch (meta.phase) {
      case "answers":
        return {
          phase: meta.phase,
          data: {
            answerOptions: question?.answerOptions,
          },
        };

      default:
        return { phase: meta.phase, data: null };
    }
  },

  // Build the view for a single player (personal info)
  async buildPersonalPlayerView(gameState: GameFullState, userId: string) {
    const { meta, question, answers, leaderboard, pin } = gameState;
    const playerAnswer = answers
      ? answers[userId]
        ? await gameRepository.getAnswer(pin, meta.currentQuestion, userId)
        : null
      : null;
    const currentRank = await gameRepository.getRank(pin, userId);
    const score = currentRank !== null ? leaderboard[currentRank].score : 0;
    const rankAbove =
      currentRank !== null && currentRank !== 0
        ? leaderboard[currentRank - 1].nickname
        : null;

    switch (meta.phase) {
      case "answers":
        return {
          phase: meta.phase,
          data: {
            hasAnswered: !!playerAnswer,
            answerOptions: question?.answerOptions,
            score,
          },
        };

      case "results":
      case "leaderboard":
        return {
          phase: meta.phase,
          data: {
            isCorrect: playerAnswer
              ? this.isAnswerCorrect(
                  question!.correctIndexes,
                  playerAnswer.indexes,
                )
              : false, // no answer
            currentRank: currentRank !== null ? currentRank + 1 : null,
            rankAbove,
            score,
          },
        };

      case "podium":
        return {
          phase: meta.phase,
          data: {
            currentRank: currentRank !== null ? currentRank + 1 : null,
            score,
          },
        };

      default:
        return { phase: meta.phase, data: { score } };
    }
  },

  buildHostView(gameState: GameFullState) {
    const { meta, leaderboard, question, answers } = gameState;
    const LEADERBOARD_LIMIT = 6;
    const PODIUM_LIMIT = 5;

    switch (meta.phase) {
      case "question":
        return {
          phase: meta.phase,
          data: {
            currentQuestion: meta.currentQuestion,
            questionCount: meta.questionCount,
            questionText: question?.questionText,
            scoringWeight: question?.scoringWeight,
          },
        };

      case "answers":
        return {
          phase: meta.phase,
          data: {
            questionText: question?.questionText,
            answerOptions: question?.answerOptions,
            timeLimit: question?.timeLimit,
            scoringWeight: question?.scoringWeight,
            answeredCount: answers ? Object.keys(answers).length : 0,
            questionImage: question?.questionImage,
          },
        };

      case "results":
        return {
          phase: meta.phase,
          data: {
            questionText: question?.questionText,
            answerOptions: question?.answerOptions,
            correctAnswers: question?.correctIndexes,
            distribution: this.buildDistribution(
              answers || {},
              question?.answerOptions.length || 0,
            ),
          },
        };

      case "leaderboard":
        return {
          phase: meta.phase,
          data: leaderboard.slice(0, LEADERBOARD_LIMIT),
        };

      case "podium":
        return {
          phase: meta.phase,
          data: leaderboard.slice(0, PODIUM_LIMIT),
        };

      default:
        return { phase: meta.phase, data: null };
    }
  },
};
