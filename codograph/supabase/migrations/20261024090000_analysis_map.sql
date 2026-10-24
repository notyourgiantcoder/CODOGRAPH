-- A whole stored analysis in one round trip. Read a page of rows at a time,
-- a large repository is hundreds of requests and the map takes minutes to
-- open; built here, it's one JSON value. Edges and routes point at files by
-- their position in the file list instead of repeating ids, which keeps the
-- value small.
--
-- Security invoker: it runs as the member asking, so the same policies decide
-- which rows exist for it as for any other read. Another organization's
-- analysis comes back as empty lists, never as its rows.
create function public.analysis_map(p_analysis_id uuid)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  with f as (
    select
      f.id, f.path, f.module, f.lines, f.bytes, f.hash, f.fan_in, f.fan_out, f.reached_by, f.exports, f.complexity,
      f.skip_reason, f.skip_detail, r.role, r.source as role_source,
      (row_number() over (order by f.path) - 1)::integer as i
    from public.files f
    -- file_id is unique in file_roles, so this never repeats a file.
    left join public.file_roles r on r.file_id = f.id
    where f.analysis_id = p_analysis_id
  )
  select json_build_object(
    'files', (
      select coalesce(json_agg(json_build_array(
        path, module, lines, bytes, hash, fan_in, fan_out, reached_by, exports, complexity, skip_reason, skip_detail, role, role_source
      ) order by i), '[]'::json)
      from f
    ),
    'edges', (
      select coalesce(json_agg(json_build_array(s.i, t.i, e.kind, e.type_only, e.specifier, e.line)), '[]'::json)
      from public.edges e
      join f s on s.id = e.source_file_id
      join f t on t.id = e.target_file_id
      where e.analysis_id = p_analysis_id
    ),
    'routes', (
      select coalesce(json_agg(json_build_array(f.i, r.method, r.path, r.line)), '[]'::json)
      from public.routes r
      join f on f.id = r.file_id
      where r.analysis_id = p_analysis_id
    )
  );
$$;

revoke execute on function public.analysis_map(uuid) from public, anon;
grant execute on function public.analysis_map(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
