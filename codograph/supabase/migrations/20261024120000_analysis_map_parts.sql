-- analysis_map built a large repository's whole map in one statement, and on
-- a big one that sometimes ran past the statement timeout. The same value now
-- comes in parts small enough to finish every time: the files in one call,
-- the routes in another, and the edges in slices the caller fetches side by
-- side. Edges and routes still point at files by their position in the file
-- list, ordered by path, which every call works out the same way.
--
-- Security invoker, like before: the member's own policies decide which rows
-- exist for each call.
drop function if exists public.analysis_map(uuid);

create function public.analysis_map_files(p_analysis_id uuid)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(json_agg(json_build_array(
    f.path, f.module, f.lines, f.bytes, f.hash, f.fan_in, f.fan_out, f.reached_by, f.exports, f.complexity,
    f.skip_reason, f.skip_detail, r.role, r.source
  ) order by f.path), '[]'::json)
  from public.files f
  -- file_id is unique in file_roles, so this never repeats a file.
  left join public.file_roles r on r.file_id = f.id
  where f.analysis_id = p_analysis_id;
$$;

-- One slice of the edges: those whose id falls in part p_part of p_parts equal
-- ranges of the uuid space. uuids are spread evenly, so the slices are too.
create function public.analysis_map_edges(p_analysis_id uuid, p_part integer, p_parts integer)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  with f as (
    select id, (row_number() over (order by path) - 1)::integer as i
    from public.files
    where analysis_id = p_analysis_id
  )
  select coalesce(json_agg(json_build_array(s.i, t.i, e.kind, e.type_only, e.specifier, e.line)), '[]'::json)
  from public.edges e
  join f s on s.id = e.source_file_id
  join f t on t.id = e.target_file_id
  where e.analysis_id = p_analysis_id
    -- The id's first 32 bits, read as a non-negative number.
    and (('x' || lpad(substr(e.id::text, 1, 8), 16, '0'))::bit(64)::bigint * p_parts) / 4294967296 = p_part;
$$;

create function public.analysis_map_routes(p_analysis_id uuid)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  with f as (
    select id, (row_number() over (order by path) - 1)::integer as i
    from public.files
    where analysis_id = p_analysis_id
  )
  select coalesce(json_agg(json_build_array(f.i, r.method, r.path, r.line)), '[]'::json)
  from public.routes r
  join f on f.id = r.file_id
  where r.analysis_id = p_analysis_id;
$$;

revoke execute on function public.analysis_map_files(uuid) from public, anon;
revoke execute on function public.analysis_map_edges(uuid, integer, integer) from public, anon;
revoke execute on function public.analysis_map_routes(uuid) from public, anon;
grant execute on function public.analysis_map_files(uuid) to authenticated, service_role;
grant execute on function public.analysis_map_edges(uuid, integer, integer) to authenticated, service_role;
grant execute on function public.analysis_map_routes(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
