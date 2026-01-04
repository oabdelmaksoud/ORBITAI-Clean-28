// Prototype Preview Diagnostic Script
// Copy and paste this entire script into your browser DevTools console
// while viewing the prototype preview

(function() {
    console.log('%c=== ORBITAI Prototype Preview Diagnostic ===', 'color: #6366f1; font-size: 16px; font-weight: bold;');
    console.log('Running diagnostics...\n');

    const results = {
        issues: [],
        warnings: [],
        success: []
    };

    // 1. Check if iframe exists
    console.log('%c[1/8] Checking iframe existence...', 'color: #8b5cf6; font-weight: bold;');
    const iframe = document.querySelector('iframe[title="Interactive Prototype Preview"]');
    if (!iframe) {
        results.issues.push('❌ Preview iframe not found in DOM');
        console.error('❌ Iframe not found');
    } else {
        results.success.push('✅ Preview iframe exists');
        console.log('✅ Iframe found');
    }

    // 2. Check srcDoc content
    console.log('\n%c[2/8] Checking iframe srcDoc content...', 'color: #8b5cf6; font-weight: bold;');
    if (iframe) {
        const srcDoc = iframe.getAttribute('srcdoc');
        if (!srcDoc || srcDoc.length === 0) {
            results.issues.push('❌ Iframe srcDoc is empty');
            console.error('❌ srcDoc is empty or missing');
        } else {
            results.success.push(`✅ srcDoc populated (${srcDoc.length} characters)`);
            console.log(`✅ srcDoc length: ${srcDoc.length} characters`);

            // Check for HTML structure
            const hasDoctype = srcDoc.includes('<!DOCTYPE') || srcDoc.includes('<!doctype');
            const hasHtml = srcDoc.includes('<html');
            const hasTailwind = srcDoc.includes('tailwindcss.com');
            const hasStyles = srcDoc.includes('<style>') || srcDoc.includes('class=');

            if (!hasDoctype && !hasHtml) {
                results.warnings.push('⚠️ srcDoc missing DOCTYPE/HTML tags');
                console.warn('⚠️ No DOCTYPE or <html> found');
            } else {
                results.success.push('✅ HTML structure present');
                console.log('✅ HTML structure present');
            }

            if (!hasTailwind) {
                results.warnings.push('⚠️ Tailwind CSS CDN not found in srcDoc');
                console.warn('⚠️ Tailwind CDN link missing');
            } else {
                results.success.push('✅ Tailwind CSS CDN included');
                console.log('✅ Tailwind CSS CDN found');
            }

            if (!hasStyles) {
                results.warnings.push('⚠️ No style tags or classes found');
                console.warn('⚠️ No styles detected');
            } else {
                results.success.push('✅ Styling present');
                console.log('✅ Styling detected');
            }

            console.log('\n%cFirst 500 characters of HTML:', 'color: #64748b;');
            console.log(srcDoc.substring(0, 500));
        }
    }

    // 3. Check Network for Tailwind CDN
    console.log('\n%c[3/8] Checking network requests (check manually in Network tab)...', 'color: #8b5cf6; font-weight: bold;');
    console.log('📡 Open DevTools → Network tab');
    console.log('📡 Filter by "tailwindcss"');
    console.log('📡 Status should be 200 (green)');
    console.log('📡 If failed or blocked → network/firewall issue');

    // 4. Check for CSP errors
    console.log('\n%c[4/8] Checking for CSP violations...', 'color: #8b5cf6; font-weight: bold;');
    const hasCspErrors = performance.getEntriesByType('navigation').some(entry =>
        entry.name && entry.name.includes('cdn.tailwindcss.com')
    );
    if (hasCspErrors) {
        results.issues.push('❌ CSP may be blocking external resources');
        console.error('❌ Potential CSP violations detected');
    } else {
        results.success.push('✅ No obvious CSP issues');
        console.log('✅ No CSP violations detected (check console for CSP errors)');
    }

    // 5. Check console for removed logs (indicates cache issue)
    console.log('\n%c[5/8] Checking for cache issues...', 'color: #8b5cf6; font-weight: bold;');
    console.log('⚠️ If you see any of these messages in console, you have cached code:');
    console.log('   - "Save effect triggered"');
    console.log('   - "Scheduling save"');
    console.log('   - "Cannot save conversation - user not authenticated"');
    console.log('   - "Messages updated"');
    console.log('\n💡 If you see these → Press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)');

    // 6. Check PreviewFrame component logs
    console.log('\n%c[6/8] Looking for PreviewFrame logs...', 'color: #8b5cf6; font-weight: bold;');
    console.log('👀 Look for logs like: "[PreviewFrame] Rendering artifact:"');
    console.log('👀 These should show contentLength, artifactType, etc.');

    // 7. Try to access iframe content
    console.log('\n%c[7/8] Attempting to access iframe content...', 'color: #8b5cf6; font-weight: bold;');
    if (iframe) {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
                const bodyText = iframeDoc.body?.innerText?.trim() || '';
                const elementCount = iframeDoc.querySelectorAll('*').length;

                console.log(`📄 Iframe has ${elementCount} elements`);
                console.log(`📝 Body text length: ${bodyText.length} characters`);

                if (elementCount <= 1) {
                    results.issues.push('❌ Iframe appears empty (1 or fewer elements)');
                    console.error('❌ Iframe is nearly empty');
                } else {
                    results.success.push(`✅ Iframe has ${elementCount} elements`);
                    console.log(`✅ Iframe content populated`);
                }

                if (bodyText.length === 0) {
                    results.warnings.push('⚠️ Iframe body text is empty');
                    console.warn('⚠️ No visible text in iframe');
                }

                // Check if Tailwind loaded
                const hasTailwindScript = iframeDoc.querySelector('script[src*="tailwindcss"]');
                if (hasTailwindScript) {
                    results.success.push('✅ Tailwind script tag present in iframe');
                    console.log('✅ Tailwind script found in iframe DOM');
                } else {
                    results.warnings.push('⚠️ Tailwind script not found in iframe DOM');
                    console.warn('⚠️ Tailwind script missing from iframe');
                }
            } else {
                results.warnings.push('⚠️ Cannot access iframe content (cross-origin)');
                console.warn('⚠️ Cannot access iframe contentDocument');
            }
        } catch (err) {
            results.warnings.push('⚠️ Cannot access iframe content: ' + err.message);
            console.warn('⚠️ Error accessing iframe:', err.message);
        }
    }

    // 8. Check for backend preview data
    console.log('\n%c[8/8] Checking for preview data...', 'color: #8b5cf6; font-weight: bold;');

    // Try to find preview in global scope (varies by implementation)
    let foundPreview = false;
    if (window.lastProjectPreview) {
        console.log('✅ Found window.lastProjectPreview');
        foundPreview = true;
    }
    if (window.lastGeneratedPreview) {
        console.log('✅ Found window.lastGeneratedPreview');
        foundPreview = true;
    }

    if (!foundPreview) {
        console.log('⚠️ Preview data not found in global scope');
        console.log('💡 This is normal - data is in React state');
    }

    // Summary
    console.log('\n%c=== DIAGNOSTIC SUMMARY ===', 'color: #6366f1; font-size: 14px; font-weight: bold;');

    if (results.success.length > 0) {
        console.log('\n%c✅ SUCCESS:', 'color: #10b981; font-weight: bold;');
        results.success.forEach(msg => console.log('  ' + msg));
    }

    if (results.warnings.length > 0) {
        console.log('\n%c⚠️ WARNINGS:', 'color: #f59e0b; font-weight: bold;');
        results.warnings.forEach(msg => console.log('  ' + msg));
    }

    if (results.issues.length > 0) {
        console.log('\n%c❌ ISSUES:', 'color: #ef4444; font-weight: bold;');
        results.issues.forEach(msg => console.log('  ' + msg));
    }

    // Next steps
    console.log('\n%c=== NEXT STEPS ===', 'color: #6366f1; font-size: 14px; font-weight: bold;');

    if (results.issues.length === 0 && results.warnings.length === 0) {
        console.log('🎉 Everything looks good! If preview still not working:');
        console.log('   1. Check Network tab for failed requests');
        console.log('   2. Clear browser cache (Cmd+Shift+R)');
        console.log('   3. Check browser console for runtime errors');
    } else {
        console.log('📋 Recommended actions:');

        if (results.issues.some(i => i.includes('srcDoc is empty'))) {
            console.log('   1. Backend may not be generating HTML properly');
            console.log('      → Check server logs for generation errors');
            console.log('      → Verify AI model response is complete');
        }

        if (results.warnings.some(w => w.includes('Tailwind'))) {
            console.log('   2. Tailwind CSS not included or blocked');
            console.log('      → Check Network tab for cdn.tailwindcss.com');
            console.log('      → Verify no CSP blocking external scripts');
            console.log('      → Check firewall/proxy settings');
        }

        if (results.issues.some(i => i.includes('empty'))) {
            console.log('   3. Iframe rendering issue');
            console.log('      → Check browser console for iframe errors');
            console.log('      → Verify srcDoc content is valid HTML');
            console.log('      → Test with simple HTML to isolate issue');
        }

        console.log('\n   📖 See PROTOTYPE_PREVIEW_DIAGNOSTIC.md for detailed steps');
    }

    console.log('\n%c=== END DIAGNOSTIC ===', 'color: #6366f1; font-size: 16px; font-weight: bold;');

    return {
        summary: {
            success: results.success.length,
            warnings: results.warnings.length,
            issues: results.issues.length
        },
        details: results
    };
})();
