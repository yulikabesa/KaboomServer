import { GameFullState, Player, UserAnswer } from "../types/game";

export const gameEngine = {
  isAnswerCorrect(correctIndexes: number[], playerAnswer: number[]) {
    // const correctSet = new Set(correctIndexes);
    // return (
    //   playerAnswer.length === correctSet.size &&
    //   playerAnswer.every((i) => correctSet.has(i))
    // );

    return correctIndexes.includes(playerAnswer[0]);
  },

  calculateScore(
    correctIndexes: number[],
    playerAnswer: number[],
    scoringWeight: number,
    timeTakenSec: number,
    timeLimitSec: number,
  ) {
    if (!this.isAnswerCorrect(correctIndexes, playerAnswer)) return 0;

    const baseScore = 1000 * scoringWeight;
    if (timeLimitSec <= 0) return baseScore;

    // full points when time starts, half points when time ends.
    const ratio = Math.min(Math.max(timeTakenSec / timeLimitSec, 0), 1);
    return Math.round(baseScore * (1 - 0.5 * ratio));
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

  mapLeaderboard(leaderboard: any[], players: Record<string, Player>) {
    return leaderboard.map((p) => ({
      // nickname: players[p.value].nickname ?? "",
      nickname: players[p.value].nickname,
      score: p.score,
      rankChange: Math.sign(
        // 1 is UP, -1 is DOWN, 0 is UNCHANGED
        players[p.value].oldRank - players[p.value].currentRank,
      ),
    }));
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
  buildPersonalPlayerView(gameState: GameFullState, userId: string) {
    const { meta, question, players, answers, leaderboard } = gameState;
    const playerAnswer = answers?.[userId];
    const currentRank = players[userId].currentRank;
    const score =
      currentRank !== null ? (leaderboard[currentRank]?.score ?? 0) : 0;
    const rankAbove =
      currentRank !== null && currentRank !== 0
        ? (leaderboard[currentRank - 1]?.nickname ?? null)
        : null;

    switch (meta.phase) {
      case "answers":
        return {
          phase: meta.phase,
          data: {
            hasAnswered: playerAnswer !== undefined,
            answerOptions: question?.answerOptions,
            score,
          },
        };

      case "results":
      case "leaderboard":
        return {
          phase: meta.phase,
          data: {
            isCorrect:
              playerAnswer !== undefined
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
    const { meta, players, leaderboard, question, answers } = gameState;
    const LEADERBOARD_LIMIT = 6;
    const PODIUM_LIMIT = 5;

    switch (meta.phase) {
      case "lobby":
        return {
          phase: meta.phase,
          data: {
            quizId: meta.quizId,
            players: Object.entries(players).map(([id, p]) => ({
              id,
              nickname: p.nickname,
            })),
          },
        };

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
