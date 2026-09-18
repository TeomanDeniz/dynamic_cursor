/******************************************************************************\
# JS - dynamic_cursor                            #       Maximum Tension       #
################################################################################
#                                                #      -__            __-     #
# Teoman Deniz                                   #  :    :!1!-_    _-!1!:    : #
# maximum-tension.com                            #  ::                      :: #
#                                                #  :!:    : :: : :  :  ::::!: #
# +.....................++.....................+ #   :!:: :!:!1:!:!::1:::!!!:  #
# : C - Maximum Tension :: Create - 2025/05/04 : #   ::!::!!1001010!:!11!!::   #
# :---------------------::---------------------: #   :!1!!11000000000011!!:    #
# : License - MIT       :: Update - 2026/09/18 : #    ::::!!!1!!1!!!1!!!::     #
# +.....................++.....................+ #       ::::!::!:::!::::      #
\******************************************************************************/

/*
** Replaces the system cursor with image cursors that follow your normal CSS
** `cursor:` rules, with optional swing physics.
**
** Works as a classic <script> (creates the global `dynamic_cursor`), and can
** be imported as an ES module through `dynamic_cursor.mjs`.
*/

(
	function(global_object)
	{
		"use strict";

		const	PI = Math.PI;
		const	TWO_PI = PI * 2;
		const	PHYSICS_STEP = 1 / 240;
		const	MAX_FRAME_TIME = 0.05;
		const	MUTATION_REFRESH_MS = 100;
		const	HIDE_CLASS = "dynamic_cursor_hidden";
		const	SWING_PRESETS =
		{
			smooth:
			{
				mode: "smooth",
				strength: 1.03,
				decay: 21.4,
				follow: 6.3,
				max_angle: PI
			},
			spring:
			{
				mode: "spring",
				strength: 1.5,
				stiffness: 90,
				damping: 9,
				max_angle: PI * 0.5
			},
			pendulum:
			{
				mode: "pendulum",
				strength: 0.13,
				gravity: 60,
				damping: 2.5,
				hang: false,
				max_angle: null
			}
		};

		const	DEFAULT_ALIASES =
		{
			"vertical-text": "text",
			"grabbing": "grab",
			"all-scroll": "move",
			"progress": "wait"
		};

		const	TEXT_INPUT_TYPES = new Set(
			["", "text", "search", "email", "url", "tel", "password", "number"]
		);

		function
			clamp(value, limit)
		{
			if (limit == null)
				return (value);
			return (Math.max(-limit, Math.min(limit, value)));
		}

		function
			wrap_angle(angle)
		{
			return (angle - TWO_PI * Math.floor((angle + PI) / TWO_PI));
		}

		function
			to_image_src(src)
		{
			const	text = String(src).trim();

			if (text.startsWith("<svg"))
				return ("data:image/svg+xml;charset=utf-8," + encodeURIComponent(text));

			return (text);
		}

		function
			parse_size(text)
		{
			if (!text)
				return (null);

			const	parts = text.trim().split(/\s+/).map(parseFloat);

			if (!(parts[0] > 0))
				return (null);

			return ([parts[0], parts[1] > 0 ? parts[1] : parts[0]]);
		}

		function
			parse_css_swing(text)
		{
			const	value = text.trim().toLowerCase();

			if (!value)
				return (undefined);

			if (value === "off" || value === "false" || value === "none")
				return (false);

			if (value === "on" || value === "true")
				return (true);

			if (SWING_PRESETS[value])
				return (value);

			return (undefined);
		}

		function
			split_cursor_list(text)
		{
			const	parts = [];
			let		depth = 0;
			let		quote = "";
			let		start = 0;

			for (let i = 0; i < text.length; ++i)
			{
				const	c = text[i];

				if (quote)
				{
					if (c === "\\")
						++i;
					else if (c === quote)
						quote = "";
				}
				else if (c === "\"" || c === "'")
					quote = c;
				else if (c === "(")
					++depth;
				else if (c === ")")
					--depth;
				else if (c === "," && depth === 0)
				{
					parts.push(text.slice(start, i).trim());
					start = i + 1;
				}
			}

			parts.push(text.slice(start).trim());

			return (parts);
		}

		const	URL_PART = /^url\(\s*(["']?)(.*?)\1\s*\)(?:\s+(-?[\d.]+)\s+(-?[\d.]+))?$/i;

		function
			normalize_swing(value, base)
		{
			if (value === undefined)
				return (base);

			if (value === false || value === null)
				return (null);

			if (value === true)
				return (base || {...SWING_PRESETS.smooth});

			if (typeof(value) === "string")
			{
				if (!SWING_PRESETS[value])
					throw (new Error("dynamic_cursor: unknown swing mode \"" + value + "\" (use smooth, spring or pendulum)"));

				return ({...SWING_PRESETS[value]});
			}

			if (typeof(value) === "object")
			{
				const	mode = value.mode || (base ? base.mode : "smooth");

				if (!SWING_PRESETS[mode])
					throw (new Error("dynamic_cursor: unknown swing mode \"" + mode + "\""));

				const	from = base && base.mode === mode ? base : SWING_PRESETS[mode];

				return ({...from, ...value, mode: mode});
			}

			return (base);
		}

		function
			create_swing_state()
		{
			return ({angle: 0, velocity: 0, push: 0, speed_x: 0, speed_y: 0});
		}

		function
			swing_rest_angle(params, lever_x, lever_y)
		{
			if (params.mode === "pendulum" && params.hang)
				return (PI / 2 - Math.atan2(lever_y, lever_x));

			return (0);
		}

		function
			step_swing(state, params, lever_x, lever_y, dx, dy, dt)
		{
			const	length_sq = lever_x * lever_x + lever_y * lever_y;

			if (length_sq < 1 || dt <= 0)
				return (false);

			const	time = Math.min(dt, MAX_FRAME_TIME);
			const	steps = Math.max(1, Math.ceil(time / PHYSICS_STEP - 1e-6));
			const	h = time / steps;
			const	rest = swing_rest_angle(params, lever_x, lever_y);

			for (let i = 0; i < steps; ++i)
				sub_step(state, params, lever_x, lever_y, length_sq, rest, dx / steps, dy / steps, h);

			const	moving = (
				Math.abs(state.push) > 1e-3 ||
				Math.abs(wrap_angle(state.angle - rest)) > 1e-3 ||
				Math.abs(state.velocity) > 1e-2 ||
				Math.abs(state.speed_x) > 1 ||
				Math.abs(state.speed_y) > 1
			);

			if (!moving)
			{
				state.angle = rest;
				state.push = state.velocity = state.speed_x = state.speed_y = 0;
			}

			return (moving);
		}

		function
			sub_step(state, params, lever_x, lever_y, length_sq, rest, dx, dy, h)
		{
			if (params.mode === "smooth")
			{
				state.push += params.strength * (lever_y * dx - lever_x * dy) / length_sq;
				state.push = clamp(state.push, params.max_angle);
				state.angle += (state.push - state.angle) * (1 - Math.exp(-params.follow * h));
				state.push *= Math.exp(-params.decay * h);
				return ;
			}

			const	cos = Math.cos(state.angle);
			const	sin = Math.sin(state.angle);
			const	turned_x = lever_x * cos - lever_y * sin;
			const	turned_y = lever_x * sin + lever_y * cos;

			if (params.mode === "spring")
			{
				state.velocity += params.strength *
					(turned_y * dx - turned_x * dy) / length_sq;
			}
			else
			{
				const	smoothing = 1 - Math.exp(-h / 0.03);
				const	old_x = state.speed_x;
				const	old_y = state.speed_y;

				state.speed_x += (dx / h - state.speed_x) * smoothing;
				state.speed_y += (dy / h - state.speed_y) * smoothing;
				state.velocity += params.strength * (turned_y * (state.speed_x - old_x) - turned_x * (state.speed_y - old_y)) / length_sq;
			}

			const	offset = wrap_angle(state.angle - rest);
			const	pull = params.mode === "spring" ? params.stiffness * offset : params.gravity * Math.sin(offset);

			state.velocity += (-pull - params.damping * state.velocity) * h;

			let	next = wrap_angle(state.angle + state.velocity * h - rest);

			if (params.max_angle != null && Math.abs(next) > params.max_angle)
			{
				next = clamp(next, params.max_angle);
				state.velocity *= -0.3;
			}

			state.angle = rest + next;
		}

		const	image_cache = new Map();

		function
			get_image(src, on_settled)
		{
			let	entry = image_cache.get(src);

			if (!entry)
			{
				const	img = new Image();

				entry = {img: img, status: "loading", width: 0, height: 0, waiting: []};
				image_cache.set(src, entry);

				const	settle = function(status)
				{
					if (entry.status !== "loading")
						return ;

					entry.status = status;
					entry.width = img.naturalWidth || 32;
					entry.height = img.naturalHeight || 32;

					if (status === "error")
						console.warn("dynamic_cursor: could not load cursor " + "image: " + src.slice(0, 120));

					entry.waiting.splice(0).forEach(function(f){f();});
				};

				img.onload = function()
				{
					if (img.decode)
						img.decode().then(
							function(){settle("ready");},
							function(){settle("ready");}
						);
					else
						settle("ready");
				};

				img.onerror = function(){settle("error");};
				img.src = src;
			}

			if (entry.status === "loading" && on_settled)
				entry.waiting.push(on_settled);

			return (entry);
		}

		function
			normalize_cursor_definition(name, definition)
		{
			if (!definition || typeof(definition) !== "object" || !definition.src)
				throw (new Error("dynamic_cursor: cursor \"" + name + "\" needs at least a `src` (image url or <svg> string)"));

			const	result =
			{
				src: to_image_src(definition.src),
				x: Number(definition.x) || 0,
				y: Number(definition.y) || 0,
				w: Number(definition.w) || null,
				h: Number(definition.h) || null,
				swing: definition.swing
			};

			get_image(result.src);
			return (result);
		}

		function
			deep_element_from_point(x, y)
		{
			let	element = document.elementFromPoint(x, y);

			while (element && element.shadowRoot)
			{
				const	inner = element.shadowRoot.elementFromPoint(x, y);

				if (!inner || inner === element)
					break ;

				element = inner;
			}

			return (element);
		}

		function
			is_over_scrollbar(element, x, y)
		{
			const	root = document.documentElement;

			if (x >= root.clientWidth || y >= root.clientHeight)
				return (true);

			if (element === root || element === document.body)
				return (false);

			if (element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth)
				return (false);

			const	rect = element.getBoundingClientRect();
			const	inner_right = rect.left + element.clientLeft + element.clientWidth;
			const	inner_bottom = rect.top + element.clientTop + element.clientHeight;

			return (
				(x > inner_right && x < rect.right - element.clientLeft) ||
				(y > inner_bottom && y < rect.bottom - element.clientTop)
			);
		}

		function
			has_scrollbar(element)
		{
			return (
				element.clientWidth > 0 && (element.scrollHeight > element.clientHeight ||
				element.scrollWidth > element.clientWidth) && (
					element.offsetWidth - element.clientWidth >
					element.clientLeft * 2 || element.offsetHeight - element.clientHeight >
					element.clientTop * 2
				)
			);
		}

		function
			is_text_at(element, x, y, user_select)
		{
			if (element.isContentEditable || element.tagName === "TEXTAREA")
				return (true);

			if (element.tagName === "INPUT")
				return (TEXT_INPUT_TYPES.has((element.getAttribute("type") || "").toLowerCase()));

			if (user_select === "none")
				return (false);

			let	node = null;

			if (document.caretPositionFromPoint)
			{
				const	position = document.caretPositionFromPoint(x, y);

				node = position && position.offsetNode;
			}
			else if (document.caretRangeFromPoint)
			{
				const	range = document.caretRangeFromPoint(x, y);

				node = range && range.startContainer;
			}
			if (
				!node || node.nodeType !== 3 || !node.data.trim() ||
				!element.contains(node)
			)
				return (false);

			const	range = document.createRange();

			range.selectNodeContents(node);

			for (const	rect of range.getClientRects())
				if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
					return (true);

			return (false);
		}

		let	active_instance = null;

		function
			start(options)
		{
			if (typeof(window) === "undefined" || typeof(document) === "undefined")
				throw (new Error("dynamic_cursor: needs a browser"));

			options = options || {};

			if (active_instance)
				active_instance.stop();

			const	cursors = new Map();
			const	aliases = {...DEFAULT_ALIASES, ...(options.aliases || {})};
			const	fallback = options.fallback === "native" ? "native" : "default";
			const	watch_dom = options.watch_dom !== false;
			const	respect_reduced_motion = options.reduced_motion !== "ignore";
			let		global_swing = normalize_swing(
				options.swing === undefined ? "smooth" : options.swing, null
			);

			for (const	name of Object.keys(options.cursors || {}))
				cursors.set(name,
					normalize_cursor_definition(name, options.cursors[name]));

			const	abort = new AbortController();
			const	listen = {signal: abort.signal, passive: true};
			const	capture = {signal: abort.signal, passive: true, capture: true};
			const	reduced_motion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

			let	host = null;
			let	image = null;
			let	hide_style = null;
			let	observer = null;
			let	running = true;
			let	pointer_x = 0;
			let	pointer_y = 0;
			let	pending_dx = 0;
			let	pending_dy = 0;
			let	pointer_inside = false;
			let	target = null;
			let	target_styles = null;
			let	styles_dirty = true;
			let	needs_hit_test = false;
			let	needs_resolve = false;
			let	depends_on_position = false;
			let	last_mutation_refresh = 0;
			let	mutation_timer = 0;
			let	current = null;
			let	mode = "native";
			let	swing_state = create_swing_state();
			let	frame_id = 0;
			let	last_time = 0;

			function
				mount()
			{
				if (!running || host)
					return ;

				hide_style = document.createElement("style");
				hide_style.textContent = (
					"html." + HIDE_CLASS + ", html." + HIDE_CLASS + " *," +
					"html." + HIDE_CLASS + " *::before," +
					"html." + HIDE_CLASS + " *::after" +
					"{cursor: none !important;}"
				);
				document.head.appendChild(hide_style);
				host = document.createElement("dynamic-cursor");
				host.setAttribute("aria-hidden", "true");

				const	shadow = host.attachShadow({mode: "closed"});
				const	style = document.createElement("style");

				style.textContent = (
					":host {" +
					 "all: initial !important;" +
					 "display: block !important;" +
					 "position: fixed !important;" +
					 "top: 0 !important; left: 0 !important;" +
					 "right: auto !important; bottom: auto !important;" +
					 "width: 0 !important; height: 0 !important;" +
					 "margin: 0 !important; padding: 0 !important;" +
					 "border: 0 !important; background: none !important;" +
					 "overflow: visible !important;" +
					 "pointer-events: none !important;" +
					 "z-index: 2147483647 !important;" +
					"}" +
					"img {" +
					 "position: absolute; top: 0; left: 0;" +
					 "display: block; max-width: none;" +
					 "user-select: none; pointer-events: none;" +
					 "opacity: 0; transition: opacity 120ms;" +
					 "will-change: transform;" +
					"}"
				);
				image = document.createElement("img");
				image.alt = "";
				image.draggable = false;
				shadow.append(style, image);
				(document.body || document.documentElement).appendChild(host);
				bring_to_top();

				if (watch_dom && window.MutationObserver)
				{
					observer = new MutationObserver(on_mutation);
					observer.observe(
						document.documentElement,
						{subtree: true, childList: true, attributes: true}
					);
				}
			}

			function
				bring_to_top()
			{
				if (!host || typeof(host.showPopover) !== "function")
					return ;

				if (!host.hasAttribute("popover"))
					host.setAttribute("popover", "manual");

				try
				{
					if (host.matches(":popover-open"))
						host.hidePopover();
					host.showPopover();
				}
				catch (error)
				{}
			}

			function
				set_mode(new_mode)
			{
				if (mode === new_mode)
					return ;

				mode = new_mode;
				document.documentElement.classList.toggle(HIDE_CLASS, new_mode !== "native");

				if (image)
					image.style.opacity = new_mode === "image" ? "1" : "0";
			}

			function
				hide_everything()
			{
				pointer_inside = false;
				target = null;
				target_styles = null;
				set_mode("native");
			}

			function
				read_styles(element)
			{
				hide_style.disabled = true;

				const	computed = window.getComputedStyle(element);
				const	result =
				{
					cursor: computed.cursor,
					size: computed.getPropertyValue("--cursor-size"),
					swing: computed.getPropertyValue("--cursor-swing") || computed.getPropertyValue("--swing"),
					user_select: computed.userSelect || computed.webkitUserSelect
				};

				hide_style.disabled = false;
				return (result);
			}

			function
				with_css_overrides(base, styles)
			{
				const	size = parse_size(styles.size);
				const	swing = parse_css_swing(styles.swing);

				return (
					{
						src: base.src,
						x: base.x,
						y: base.y,
						w: size ? size[0] : base.w,
						h: size ? size[1] : base.h,
						swing: swing === undefined ? base.swing : swing
					}
				);
			}

			function
				resolve(element, styles)
			{
				depends_on_position = has_scrollbar(element) ||
					element === document.documentElement;

				if (is_over_scrollbar(element, pointer_x, pointer_y))
					return ({mode: "native"});

				for (const	part of split_cursor_list(styles.cursor))
				{
					const	url = URL_PART.exec(part);

					if (url)
					{
						const	src = url[2].replace(/\\(.)/g, "$1");

						if (get_image(src, request_resolve).status === "error")
							continue ;

						return (
							{
								mode: "image",
								definition: with_css_overrides({
									src: src,
									x: Number(url[3]) || 0,
									y: Number(url[4]) || 0,
									w: null, h: null, swing: undefined
								}, styles)
							}
						);
					}

					if (/^[a-z-]+$/i.test(part) === false)
						continue ;

					let	keyword = part.toLowerCase();

					if (keyword === "none")
						return ({mode: "none"});

					if (keyword === "auto")
					{
						depends_on_position = true;
						keyword = is_text_at(element, pointer_x, pointer_y,
							styles.user_select) ? "text" : "default";
					}

					const	found = (
						cursors.get(keyword) ||
						cursors.get(aliases[keyword]) ||
						(fallback === "default" ? cursors.get("default") : null)
					);

					if (!found || get_image(found.src).status === "error")
						return ({mode: "native"});

					return ({mode: "image", definition: with_css_overrides(found, styles)});
				}

				return ({mode: "native"});
			}

			function
				apply(result)
			{
				if (result.mode !== "image")
				{
					current = null;
					set_mode(result.mode);
					return ;
				}

				const	definition = result.definition;
				const	entry = get_image(definition.src, request_resolve);

				if (entry.status === "loading")
					return ;

				let	width = definition.w;
				let	height = definition.h;

				if (!width && !height)
				{
					width = entry.width;
					height = entry.height;
				}
				else if (!width)
					width = height * entry.width / entry.height;
				else if (!height)
					height = width * entry.height / entry.width;

				const	swing = (
					respect_reduced_motion && reduced_motion &&
					reduced_motion.matches ? null :
					normalize_swing(definition.swing, global_swing)
				);
				const	key = [definition.src, definition.x, definition.y, width, height, JSON.stringify(swing)].join("|");

				if (!current || current.key !== key)
				{
					if (!current || !current.swing || !swing || current.swing.mode !== swing.mode)
						swing_state = create_swing_state();

					if (!current || current.src !== definition.src)
						image.src = definition.src;

					image.style.width = width + "px";
					image.style.height = height + "px";
					image.style.transformOrigin = definition.x + "px " + definition.y + "px";

					current =
					{
						key: key,
						src: definition.src,
						x: definition.x,
						y: definition.y,
						lever_x: width / 2 - definition.x,
						lever_y: height / 2 - definition.y,
						swing: swing
					};

					if (swing)
						swing_state.angle = swing_rest_angle(swing, current.lever_x, current.lever_y);
				}

				set_mode("image");
			}

			function
				wake()
			{
				if (running && !frame_id)
					frame_id = window.requestAnimationFrame(frame);
			}

			function
				request_resolve()
			{
				needs_resolve = true;
				wake();
			}

			function
				frame(now)
			{
				frame_id = 0;

				const	dt = last_time ? Math.min((now - last_time) / 1000, MAX_FRAME_TIME) : 1 / 60;
				const	dx = pending_dx;
				const	dy = pending_dy;

				last_time = now;
				pending_dx = pending_dy = 0;

				if (!pointer_inside || !host)
				{
					last_time = 0;
					return ;
				}

				if (needs_hit_test)
				{
					const	element = deep_element_from_point(pointer_x, pointer_y);

					needs_hit_test = false;

					if (element !== target)
					{
						target = element;
						styles_dirty = true;
					}

					needs_resolve = true;
				}

				if (needs_resolve || (depends_on_position && (dx || dy)))
				{
					needs_resolve = false;

					if (!target)
						set_mode("native");
					else
					{
						if (styles_dirty || !target_styles)
						{
							target_styles = read_styles(target);
							styles_dirty = false;
						}

						apply(resolve(target, target_styles));
					}
				}

				let	moving = false;
				let	angle = 0;

				if (mode === "image" && current)
				{
					if (current.swing)
					{
						moving = step_swing(swing_state, current.swing, current.lever_x, current.lever_y, dx, dy, dt);
						angle = swing_state.angle;
					}

					image.style.transform = (
						"translate3d(" + (pointer_x - current.x) + "px," +
						(pointer_y - current.y) + "px,0)" +
						(angle ? " rotate(" + angle + "rad)" : "")
					);
				}

				if (moving || needs_resolve || needs_hit_test)
					wake();
				else
					last_time = 0;
			}

			function
				on_pointer_move(event)
			{
				if (event.pointerType === "touch")
				{
					hide_everything();
					return ;
				}

				const	element = event.composedPath ? event.composedPath()[0] : event.target;

				if (pointer_inside)
				{
					pending_dx += event.clientX - pointer_x;
					pending_dy += event.clientY - pointer_y;
				}

				pointer_inside = true;
				pointer_x = event.clientX;
				pointer_y = event.clientY;

				if (element !== target)
				{
					target = element && element.nodeType === 1 ? element : null;
					styles_dirty = true;
					needs_resolve = true;
				}

				wake();
			}

			function
				on_pointer_button()
			{
				styles_dirty = true;
				needs_resolve = true;
				wake();
			}

			function
				on_leave_window(event)
			{
				if (!event.relatedTarget)
					hide_everything();
			}

			function
				on_scroll()
			{
				needs_hit_test = true;
				wake();
			}

			function
				on_mutation(records)
			{
				for (const record of records)
				{
					if (record.attributeName === "open" && record.target !== host)
					{
						bring_to_top();
						break ;
					}
				}

				if (!pointer_inside || mutation_timer)
					return ;

				const	wait = Math.max(0, last_mutation_refresh + MUTATION_REFRESH_MS - Date.now());

				mutation_timer = window.setTimeout(
					function()
					{
						mutation_timer = 0;
						last_mutation_refresh = Date.now();
						styles_dirty = true;
						needs_hit_test = true;
						wake();
					},
					wait
				);
			}

			function
				refresh_everything()
			{
				styles_dirty = true;
				needs_hit_test = true;
				current = null;
				wake();
			}

			document.addEventListener("pointermove", on_pointer_move, listen);
			document.addEventListener("pointerdown", on_pointer_button, listen);
			document.addEventListener("pointerup", on_pointer_button, listen);
			document.addEventListener("pointerout", on_leave_window, listen);
			document.addEventListener("scroll", on_scroll, capture);
			document.addEventListener("fullscreenchange", bring_to_top, listen);
			document.addEventListener(
				"toggle",
				function(event)
				{
					if (event.target !== host)
						bring_to_top();
				},
				capture
			);
			document.addEventListener(
				"visibilitychange",
				function()
				{
					if (document.hidden)
						hide_everything();
				},
				listen
			);
			window.addEventListener("blur", hide_everything, listen);
			window.addEventListener("resize", on_scroll, listen);

			if (reduced_motion && reduced_motion.addEventListener)
				reduced_motion.addEventListener("change", refresh_everything, listen);

			if (document.readyState === "loading")
				document.addEventListener("DOMContentLoaded", mount, {signal: abort.signal, once: true});
			else
				mount();

			const	instance =
			{
				stop: function()
				{
					if (!running)
						return ;

					running = false;
					abort.abort();

					if (frame_id)
						window.cancelAnimationFrame(frame_id);

					if (mutation_timer)
						window.clearTimeout(mutation_timer);

					if (observer)
						observer.disconnect();

					document.documentElement.classList.remove(HIDE_CLASS);

					if (host)
						host.remove();

					if (hide_style)
						hide_style.remove();

					if (active_instance === instance)
						active_instance = null;
				},

				refresh: refresh_everything,

				set_cursor: function(name, definition)
				{
					cursors.set(name, normalize_cursor_definition(name, definition));
					refresh_everything();
					return (instance);
				},

				remove_cursor: function(name)
				{
					cursors.delete(name);
					refresh_everything();
					return (instance);
				},

				set_swing: function(value)
				{
					global_swing = normalize_swing(value, null);
					refresh_everything();
					return (instance);
				},

				get running() {return (running);}
			};

			active_instance = instance;
			return (instance);
		}

		const	dynamic_cursor =
		{
			start: start,
			stop: function()
			{
				if (active_instance)
					active_instance.stop();
			},
			swing_presets: SWING_PRESETS,
			create_swing_state: create_swing_state,
			step_swing: step_swing
		};

		Object.freeze(SWING_PRESETS.smooth);
		Object.freeze(SWING_PRESETS.spring);
		Object.freeze(SWING_PRESETS.pendulum);
		Object.freeze(dynamic_cursor);

		if (typeof(module) === "object" && module.exports)
			module.exports = dynamic_cursor;

		global_object.dynamic_cursor = dynamic_cursor;
	}
)(typeof(globalThis) !== "undefined" ? globalThis : this);
