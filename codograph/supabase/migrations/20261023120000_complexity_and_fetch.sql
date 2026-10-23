-- Two more facts from the parser. A parsed file's complexity is one plus every
-- branch point written in it; a skipped file's syntax is unknown, so it has
-- none. Rows stored by an older parser stay null: their analysis is marked
-- outdated by its schema version and asks to be re-run.
alter table public.files
  add column complexity integer,
  add constraint files_complexity_check check (complexity is null or complexity >= 1),
  add constraint files_skipped_have_no_complexity_check check (skip_reason is null or complexity is null);

-- A fetch() call whose URL matched exactly one route's file is an edge too.
-- The inline check was created unnamed, so it's found by what it checks.
do $$
declare
  existing text;
begin
  select conname into existing
  from pg_constraint
  where conrelid = 'public.edges'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%re-export%';
  if existing is null then
    raise exception 'edges kind check not found';
  end if;
  execute format('alter table public.edges drop constraint %I', existing);
end;
$$;

alter table public.edges
  add constraint edges_kind_check check (kind in ('import', 're-export', 'dynamic-import', 'require', 'fetch')),
  add constraint edges_fetch_not_type_only_check check (kind <> 'fetch' or not type_only);
