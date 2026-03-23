(function () {
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (window.Fluid && Fluid.events) {
    Fluid.events.registerScrollTopArrowEvent = function () {
      var topArrow = jQuery('#scroll-top-button');
      if (topArrow.length === 0) {
        return;
      }
      var board = jQuery('#board');
      if (board.length === 0) {
        return;
      }

      var posDisplay = false;
      var scrollDisplay = false;
      var pulling = false;
      var startY = 0;
      var pullDistance = 0;

      var setTopArrowPos = function () {
        var boardRight = board[0].getClientRects()[0].right;
        var bodyWidth = document.body.offsetWidth;
        var right = bodyWidth - boardRight;
        posDisplay = right >= 50;
        topArrow.css({
          right: (posDisplay ? right - 64 : 18) + 'px'
        });
        topArrow.toggleClass('is-visible', posDisplay && scrollDisplay);
      };

      setTopArrowPos();
      jQuery(window).resize(setTopArrowPos);

      var headerHeight = board.offset().top;
      Fluid.utils.listenScroll(function () {
        var scrollHeight = document.body.scrollTop + document.documentElement.scrollTop;
        scrollDisplay = scrollHeight >= headerHeight;
        topArrow.toggleClass('is-visible', posDisplay && scrollDisplay);
      });

      var pointerY = function (event) {
        if (event.touches && event.touches.length) {
          return event.touches[0].clientY;
        }
        if (event.changedTouches && event.changedTouches.length) {
          return event.changedTouches[0].clientY;
        }
        return event.clientY;
      };

      var resetPull = function () {
        pulling = false;
        pullDistance = 0;
        topArrow.removeClass('is-pulling');
        topArrow.css('transform', '');
      };

      var onMove = function (event) {
        if (!pulling) {
          return;
        }

        var currentY = pointerY(event);
        pullDistance = Math.max(0, Math.min(currentY - startY, 90));
        topArrow.css('transform', 'translateY(' + pullDistance + 'px)');

        if (event.cancelable) {
          event.preventDefault();
        }
      };

      var onEnd = function () {
        if (!pulling) {
          return;
        }

        var shouldTrigger = pullDistance > 36;
        resetPull();

        if (shouldTrigger) {
          jQuery('body,html').animate({
            scrollTop: 0,
            easing: 'swing'
          });
        }
      };

      topArrow.on('mousedown touchstart', function (event) {
        if (!topArrow.hasClass('is-visible')) {
          return;
        }

        pulling = true;
        startY = pointerY(event);
        pullDistance = 0;
        topArrow.addClass('is-pulling');

        if (event.cancelable) {
          event.preventDefault();
        }
      });

      jQuery(document).on('mousemove touchmove', onMove);
      jQuery(document).on('mouseup touchend touchcancel', onEnd);

      topArrow.on('click', function () {
        if (pullDistance > 0) {
          return;
        }
        jQuery('body,html').animate({
          scrollTop: 0,
          easing: 'swing'
        });
      });
    };
  }

  function forEachNode(selector, callback) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), callback);
  }

  function markRevealTargets() {
    var groups = [
      '.home-hero-panel',
      '.home-section-head',
      '.index-card',
      '.about-avatar',
      '.about-hero-card',
      '.about-panel',
      '.post-lead-card',
      '.post-prevnext article',
      '.archive li',
      '.list-group-item',
      '.category',
      '.category-sub',
      '.category-list-item',
      '.tagcloud a',
      '.post-content .markdown-body > *',
      '.post-content > hr',
      '.post-content > div'
    ];

    groups.forEach(function (selector) {
      forEachNode(selector, function (node, index) {
        if (node.classList.contains('reveal-item')) {
          return;
        }

        node.classList.add('reveal-item');
        node.style.setProperty('--reveal-delay', Math.min(index * 70, 420) + 'ms');
      });
    });
  }

  function showAllRevealTargets() {
    forEachNode('.reveal-item', function (node) {
      node.classList.add('is-visible');
    });
  }

  function setupRevealObserver() {
    markRevealTargets();

    if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
      showAllRevealTargets();
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.14,
      rootMargin: '0px 0px -8% 0px'
    });

    forEachNode('.reveal-item', function (node) {
      observer.observe(node);
    });
  }

  function updateNavbarState() {
    var navbar = document.getElementById('navbar');
    if (!navbar) {
      return;
    }

    if (window.scrollY > 12) {
      navbar.classList.add('nav-scrolled');
    } else {
      navbar.classList.remove('nav-scrolled');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupRevealObserver();
    updateNavbarState();
    window.addEventListener('scroll', updateNavbarState, { passive: true });
  });
})();
