import { GameFullState, GameQuestion } from "../types/game";

export const gameEngine = {
  formatQuestion(q: GameQuestion) {
    return {
      question: q.question,
      answers: q.answers,
      timeLimit: q.timeLimit,
    };
  },

  calculateScore(correctIndexes: number[], answer: number) {
    if (correctIndexes.includes(answer)) {
      return 1000;
    }
    return 0;
  },

  buildDistribution(answers: Record<string, string>, answerCount: number) {
    const counts = new Array(answerCount).fill(0);
    for (const answer of Object.values(answers)) {
      counts[Number(answer)]++;
    }

    return counts;
  },

  mapLeaderboard(leaderboard: any[], players: any) {
    return leaderboard.map((p) => ({
      playerId: p.value,
      nickname: players[p.value],
      score: p.score,
    }));
  },

  // Build the view that all players in a game can see
  buildSharedPlayerView(gameState: GameFullState) {
    const { meta, players, leaderboard, question } = gameState;

    switch (meta.phase) {
      case "question": //todo: replace to answers
        return {
          phase: meta.phase,
          data: {
            answers: question?.answers,
          },
        };

      case "leaderboard":
        return {
          phase: meta.phase,
          data: this.mapLeaderboard(leaderboard, players),
        };

      default:
        return { phase: meta.phase, data: {} };
    }
  },

  // Build the view for a single player (personal info)
  buildPersonalPlayerView(gameState: GameFullState, userId: string) {
    const { meta, question, answers } = gameState;
    const playerAnswer = answers?.[userId];

    switch (meta.phase) {
      case "question":
        return {
          phase: meta.phase,
          data: {
            hasAnswered: playerAnswer !== undefined,
          },
        };

      case "results":
        return {
          phase: meta.phase,
          data: {
            isCorrect:
              playerAnswer !== undefined
                ? question?.correctIndexes.includes(Number(playerAnswer)) // todo: fix
                : null,
            // todo: score
          },
        };

      default:
        return { phase: meta.phase, data: {} };
    }
  },

  buildHostView(gameState: GameFullState) {
    const { meta, players, leaderboard, question, answers } = gameState;

    switch (meta.phase) {
      case "question":
        return {
          phase: meta.phase,
          data: {
            currentQuestion: meta.currentQuestion,
            questionCount: meta.questionCount,
            question: question?.question,
            answers: question?.answers, // todo: remove
            timeLimit: question?.timeLimit, // todo: remove
            answeredCount: answers ? Object.keys(answers).length : 0, // todo: remove
          },
        };

      case "answers":
        return {
          phase: meta.phase,
          data: {
            answers: question?.answers,
            timeLimit: question?.timeLimit,
            answeredCount: answers ? Object.keys(answers).length : 0,
          },
        };

      case "results":
        return {
          phase: meta.phase,
          data: {
            answers: answers,
            correctAnswers: question?.correctIndexes,
            distribution: this.buildDistribution(
              answers || {},
              question?.answers.length || 0,
            ),
          },
        };

      case "leaderboard":
        return {
          phase: meta.phase,
          data: this.mapLeaderboard(leaderboard, players),
        };

      default:
        return { phase: meta.phase, data: {} };
    }
  },
};
