import { GameFullState, GameQuestion, UserAnswer } from "../types/game";

export const gameEngine = {
  formatQuestion(q: GameQuestion) {
    return {
      question: q.question,
      answers: q.answers,
      timeLimit: q.timeLimit,
    };
  },

  isAnswerCorrect(correctIndexes: number[], playerAnswer: number[]) {
    const correctSet = new Set(correctIndexes);
    return (
      playerAnswer.length === correctSet.size &&
      playerAnswer.every((i) => correctSet.has(i))
    );
  },

  calculateScore(correctIndexes: number[], playerAnswer: number[]) {
    if (this.isAnswerCorrect(correctIndexes, playerAnswer)) {
      return 1000;
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

  mapLeaderboard(leaderboard: any[], players: any) {
    return leaderboard.map((p) => ({
      nickname: players[p.value],
      score: p.score,
    }));
  },

  // Build the view that all players in a game can see
  buildSharedPlayerView(gameState: GameFullState) {
    const { meta, players, leaderboard, question } = gameState;

    switch (meta.phase) {
      case "answers":
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
      case "answers":
        return {
          phase: meta.phase,
          data: {
            hasAnswered: playerAnswer !== undefined,
          },
        }; // todo: change this phase to a new phase

      case "results":
        return {
          phase: meta.phase,
          data: {
            isCorrect:
              playerAnswer !== undefined
                ? this.isAnswerCorrect(
                    question!.correctIndexes,
                    playerAnswer.indexes,
                  )
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
          },
        };

      case "answers":
        return {
          phase: meta.phase,
          data: {
            question: question?.question,
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
