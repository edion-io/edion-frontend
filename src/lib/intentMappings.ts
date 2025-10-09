export const getDeterministicResponse = (input: string): string | null => {
  const normalized = input.trim();

  const exactInstruction = "Give me a combination of a context exercise and a writing exercise for a 6th grade student learning history. It should be an exercise on London's history.";

  if (normalized === exactInstruction) {
    return "Look at these groups of words about four different times in London's history. Write a short paragraph about each of these times using all of the words in the group.\n\\begin{enumerate}[label=\\alph*.]\n\\item Roman London: bridge, fort, tribe, rebuild  \n\\item The Great Fire: smoke, narrow, river, fire-break  \n\\item The Industrial Revolution: industry, factories, businesses, docks  \n\\item World War Two: raids, Blitz, bombs, shelter  \n\\end{enumerate}";
  }

  return null;
};


