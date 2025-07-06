# _plugins/fetch_scholar_citations.rb
require 'nokogiri'
require 'open-uri'
require 'yaml'

module Jekyll
  class ScholarCitationsGenerator < Generator
    safe true
    priority :low

    def generate(site)
      scholar_id = site.data.dig('profile', 'gscholar')
      if scholar_id.to_s.strip.empty?
        Jekyll.logger.warn "ScholarCitationsGenerator:", "no gscholar ID found in _data/profile.yml"
        return
      end

      url = scholar_id.include?('scholar.google') ?
              scholar_id :
              "https://scholar.google.com/citations?user=#{scholar_id}&hl=en"
      Jekyll.logger.debug "ScholarCitationsGenerator:", "fetching #{url}"

      begin
        html = URI.open(url,
                        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '\
                                        'AppleWebKit/537.36 (KHTML, like Gecko) '\
                                        'Chrome/114.0.0.0 Safari/537.36')
        doc = Nokogiri::HTML(html)

        cell = doc.at_css('#gsc_rsb_st tbody tr:nth-child(1) td:nth-child(2)')
        unless cell
          Jekyll.logger.error "ScholarCitationsGenerator:", "cannot find citations cell—page structure may have changed"
          return
        end
        total = cell.text.strip.to_i
Jekyll.logger.info "ScholarCitationsGenerator:", "total citations = #{total}"

data = {
  'total_citations' => total,
  'last_updated'    => Time.now.utc.strftime('%Y-%m-%d %H:%M UTC')
}

#  NEW: update the in‑memory data so Liquid sees it right away
site.data['citations'] = data

# then still write it to disk for future builds / CI
File.write(File.join(site.source, '_data', 'citations.yml'), data.to_yaml)
Jekyll.logger.info "ScholarCitationsGenerator:", "wrote citations to _data/citations.yml"

      rescue => e
        Jekyll.logger.error "ScholarCitationsGenerator:", "exception: #{e.class} #{e.message}"
        Jekyll.logger.debug e.backtrace.join("\n")
      end
    end
  end
end
