drop policy if exists "Users can update their own todos" on public.todos;

create policy "Users can update their own todos"
  on public.todos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
