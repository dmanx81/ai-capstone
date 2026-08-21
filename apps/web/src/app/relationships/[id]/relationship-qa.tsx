"use client";

import { useState } from "react";

import {
  askRelationship,
  type RelationshipAnswerResponse,
} from "../interaction-actions";

type RelationshipQaProps = {
  accountId: string;
};

const sourceDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default function RelationshipQa({ accountId }: RelationshipQaProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<RelationshipAnswerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (trimmedQuestion.length < 3) {
      setError("Ask a question with at least 3 characters.");
      setAnswer(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnswer(null);
    const result = await askRelationship(accountId, trimmedQuestion);
    setIsLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    setAnswer(result.data);
  }

  return (
    <section className="mt-6 rounded-xl border bg-white p-8">
      <h2 className="text-2xl font-semibold">Ask about this relationship</h2>
      <p className="mt-2 text-sm text-gray-600">
        Ask about themes, risks, commitments, or changes in the recorded interactions.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <label htmlFor="relationship-question" className="sr-only">
          Relationship question
        </label>
        <textarea
          id="relationship-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          maxLength={2_000}
          placeholder="What commitments remain unresolved?"
          className="w-full rounded-md border px-3 py-2"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Searching relationship history..." : "Ask question"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {answer && (
        <div className="mt-6 space-y-5">
          <div>
            <h3 className="font-semibold">Answer</h3>
            <p className="mt-2 whitespace-pre-wrap text-gray-700">{answer.answer}</p>
          </div>

          <div>
            <h3 className="font-semibold">Evidence</h3>
            {answer.sources.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">No matching interaction evidence was found.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {answer.sources.map((source, index) => (
                  <li key={`${source.interaction_id}-${index}`} className="rounded-md border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Interaction {source.interaction_id.slice(0, 8)} · {sourceDateFormatter.format(new Date(source.created_at))}
                    </p>
                    <p className="mt-2 text-sm text-gray-700">{source.excerpt}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}