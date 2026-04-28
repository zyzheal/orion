import { useMemo } from 'react';

export function useCommandSuggestions(
  input: string,
  commands: Array<{ name: string; aliases: string[] }>
): string[] {
  return useMemo(() => {
    if (!input.startsWith('/')) return [];

    const query = input.slice(1).toLowerCase();
    const matches = commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().startsWith(query) ||
        cmd.aliases.some((a) => a.toLowerCase().startsWith(query))
    );

    return matches.slice(0, 8).map((cmd) => `/${cmd.name}`);
  }, [input, commands]);
}
